/**
 * @file: httpTransport.ts
 * @description: Express route handler для /mcp (Streamable HTTP, stateless).
 *   Резолвит auth context из Bearer JWT, создаёт МCP server+transport на каждый
 *   запрос и не проксирует Express route handlers/бизнес-логику напрямую.
 *
 *   Body parsing is dedicated to this route (mcpBodyParser) and MUST be mounted
 *   before the app-wide express.json({limit:'10mb'}) parser in server/index.ts —
 *   otherwise the 10mb parser consumes the request first and this route's own
 *   256kb limit becomes unreachable dead code.
 * @dependencies: @modelcontextprotocol/sdk, server/mcp/authContext.ts, server/mcp/createMcpServer.ts
 * @created: 2026-08-02
 */

import express, { type NextFunction, type Request, Response } from "express";
import { randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { resolveMcpAuthContext } from "./authContext";
import { createMcpServer } from "./createMcpServer";
import { runWithMcpTelemetry } from "./telemetry";

const MCP_MAX_BODY_BYTES = 256 * 1024;

export const mcpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "RATE_LIMITED", message: "Too many MCP requests, please try again later" },
});

/**
 * Route-scoped JSON body parser enforcing the real MCP size limit. Must run before
 * (and instead of) the app-wide body parser for this route — see file header.
 */
export const mcpBodyParser = express.json({ limit: MCP_MAX_BODY_BYTES });

/** Converts body-parser failures (oversized/malformed body) into the MCP JSON error shape. */
export function mcpBodyErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (!isBodyParserError(err)) {
    next(err);
    return;
  }
  if (err.status === 413 || err.type === "entity.too.large") {
    res.status(413).json({ code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds MCP size limit" });
    return;
  }
  res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid JSON body" });
}

function isBodyParserError(err: unknown): err is { status?: number; type?: string } {
  return typeof err === "object" && err !== null && ("status" in err || "type" in err);
}

export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const start = Date.now();
  const requestedMethod = extractJsonRpcMethod(req.body);
  const requestId = randomUUID();

  try {
    const authResolution = await resolveMcpAuthContext(req.headers.authorization);
    const server = createMcpServer(authResolution);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    const userId = authResolution.status === "ok" ? authResolution.context.userId : null;

    await runWithMcpTelemetry({ requestId, userId }, async () => {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    logMcpRequest({ requestId, method: requestedMethod, userId, status: res.statusCode, durationMs: Date.now() - start });
  } catch (error) {
    console.error(`[mcp] transport error requestId=${requestId}:`, error);
    logMcpRequest({ requestId, method: requestedMethod, userId: null, status: 500, durationMs: Date.now() - start, failed: true });
    if (!res.headersSent) {
      res.status(500).json({ code: "INTERNAL_ERROR", message: "Internal error" });
    }
  }
}

function extractJsonRpcMethod(body: unknown): string | null {
  if (body && typeof body === "object" && "method" in body && typeof (body as any).method === "string") {
    return (body as any).method;
  }
  return null;
}

function logMcpRequest(entry: { requestId: string; method: string | null; userId: number | null; status: number; durationMs: number; failed?: boolean }): void {
  // Deliberately excludes Authorization header, JWT payload and tool arguments.
  console.log(
    `[mcp] requestId=${entry.requestId} method=${entry.method ?? "unknown"} userId=${entry.userId ?? "anonymous"} status=${entry.status} durationMs=${entry.durationMs}${entry.failed ? " failed=true" : ""}`,
  );
}
