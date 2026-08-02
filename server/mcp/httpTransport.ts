/**
 * @file: httpTransport.ts
 * @description: Express route handler для /mcp (Streamable HTTP, stateless).
 *   Резолвит auth context из Bearer JWT, создаёт МCP server+transport на каждый
 *   запрос и не проксирует Express route handlers/бизнес-логику напрямую.
 * @dependencies: @modelcontextprotocol/sdk, server/mcp/authContext.ts, server/mcp/createMcpServer.ts
 * @created: 2026-08-02
 */

import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { resolveMcpAuthContext } from "./authContext";
import { createMcpServer } from "./createMcpServer";

const MCP_MAX_BODY_BYTES = 256 * 1024;

export const mcpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "RATE_LIMITED", message: "Too many MCP requests, please try again later" },
});

export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const bodyBytes = (req.rawBody as Buffer | undefined)?.byteLength ?? 0;
  if (bodyBytes > MCP_MAX_BODY_BYTES) {
    res.status(413).json({ code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds MCP size limit" });
    return;
  }

  const start = Date.now();
  const requestedMethod = extractJsonRpcMethod(req.body);

  try {
    const authResolution = await resolveMcpAuthContext(req.headers.authorization);
    const server = createMcpServer(authResolution);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    const userId = authResolution.status === "ok" ? authResolution.context.userId : null;
    logMcpRequest({ method: requestedMethod, userId, status: res.statusCode, durationMs: Date.now() - start });
  } catch (error) {
    console.error("[mcp] transport error:", error);
    logMcpRequest({ method: requestedMethod, userId: null, status: 500, durationMs: Date.now() - start, failed: true });
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

function logMcpRequest(entry: { method: string | null; userId: number | null; status: number; durationMs: number; failed?: boolean }): void {
  // Deliberately excludes Authorization header, JWT payload and tool arguments.
  console.log(
    `[mcp] method=${entry.method ?? "unknown"} userId=${entry.userId ?? "anonymous"} status=${entry.status} durationMs=${entry.durationMs}${entry.failed ? " failed=true" : ""}`,
  );
}
