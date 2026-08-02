/**
 * @file: toolResult.ts
 * @description: Единый builder успешного результата и ошибки MCP tool
 * @dependencies: @modelcontextprotocol/sdk, server/mcp/errors.ts
 * @created: 2026-08-02
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpToolError, type McpErrorCode } from "./errors";

export function toolSuccess(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    structuredContent: isPlainRecord(data) ? data : { result: data },
  };
}

export function toolError(error: unknown): CallToolResult {
  const { code, message, recoverable } = normalizeError(error);
  const payload: { code: McpErrorCode; message: string; recoverable?: boolean } = { code, message };
  if (recoverable) {
    payload.recoverable = true;
  }
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
}

/**
 * Wraps a tool handler with uniform error translation and structured logging.
 * Logs only the tool name, user id and duration/outcome — never raw arguments or
 * results, which may contain user-provided data.
 */
export function withToolLogging<Args extends unknown[]>(
  toolName: string,
  userId: number,
  handler: (...args: Args) => Promise<CallToolResult>,
): (...args: Args) => Promise<CallToolResult> {
  return async (...args: Args) => {
    const startedAt = Date.now();
    try {
      const result = await handler(...args);
      console.log(
        `[mcp:tool] ${toolName} user=${userId} ok=${!result.isError} durationMs=${Date.now() - startedAt}`,
      );
      return result;
    } catch (err) {
      console.log(
        `[mcp:tool] ${toolName} user=${userId} ok=false durationMs=${Date.now() - startedAt} threw=true`,
      );
      return toolError(err);
    }
  };
}

function normalizeError(error: unknown): { code: McpErrorCode; message: string; recoverable: boolean } {
  if (error instanceof McpToolError) {
    return { code: error.code, message: error.message, recoverable: error.recoverable };
  }
  // Never leak stack traces or internal details to the client.
  console.error("[mcp] unhandled tool error:", error);
  return { code: "INTERNAL_ERROR", message: "Internal error", recoverable: false };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
