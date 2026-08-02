/**
 * @file: httpTransport.ts
 * @description: Mount защищённого MCP Streamable HTTP endpoint (/mcp) на существующий Express app.
 *   Использует текущую JWT-аутентификацию (authMiddleware) и не заменяет REST routes.
 * @dependencies: express, express-rate-limit, @modelcontextprotocol/sdk, server/middleware/auth.ts
 * @created: 2026-08-02
 */

import type { Express, Request, Response } from 'express';
import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authMiddleware } from '../middleware/auth';
import { requireAuthContext, type McpAuthContext } from './authContext';
import { createMcpServer } from './createMcpServer';
import { McpToolError, MCP_ERROR_CODES } from './errors';

// Tool payloads are small structured JSON; large files go through upload sessions (TASK-003+),
// never through /mcp tool arguments.
const MCP_BODY_LIMIT = '1mb';

const mcpRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  // Rate limit per authenticated user when known, otherwise per IP.
  keyGenerator: (req: Request) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? 'unknown')),
  message: { error: 'RATE_LIMITED', message: 'Too many MCP requests, slow down.' },
});

export function mountMcpHttpTransport(app: Express): void {
  app.post(
    '/mcp',
    mcpRateLimiter,
    express.json({ limit: MCP_BODY_LIMIT }),
    authMiddleware({ required: true }),
    async (req: Request, res: Response) => {
      let auth: McpAuthContext;
      try {
        auth = requireAuthContext(req);
      } catch (err) {
        respondWithMcpError(res, err);
        return;
      }

      const server = createMcpServer(auth);
      // Stateless mode: a fresh server + transport per request avoids cross-request/user
      // state leakage and keeps this MVP endpoint simple to reason about.
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

      res.on('close', () => {
        transport.close();
        server.close();
      });

      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        console.error('[mcp] request handling failed', {
          userId: auth.userId,
          error: err instanceof Error ? err.message : String(err),
        });
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal error' },
            id: null,
          });
        }
      }
    },
  );

  // GET/DELETE are only meaningful for stateful sessions (resumable streams / explicit
  // session close), which this stateless MVP endpoint does not use.
  app.get('/mcp', (_req, res) => {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'This MCP endpoint is stateless; use POST.' });
  });
  app.delete('/mcp', (_req, res) => {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'This MCP endpoint is stateless; use POST.' });
  });
}

function respondWithMcpError(res: Response, err: unknown): void {
  const mcpError =
    err instanceof McpToolError ? err : new McpToolError(MCP_ERROR_CODES.INTERNAL_ERROR, 'Internal error');

  const status =
    mcpError.code === MCP_ERROR_CODES.AUTH_REQUIRED || mcpError.code === MCP_ERROR_CODES.AUTH_INVALID
      ? 401
      : mcpError.code === MCP_ERROR_CODES.FORBIDDEN
        ? 403
        : mcpError.code === MCP_ERROR_CODES.NOT_FOUND
          ? 404
          : mcpError.code === MCP_ERROR_CODES.VALIDATION_ERROR
            ? 400
            : 500;

  res.status(status).json({ error: mcpError.code, message: mcpError.message });
}
