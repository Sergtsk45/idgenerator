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
  const { code, message } = normalizeError(error);
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ code, message }) }],
  };
}

function normalizeError(error: unknown): { code: McpErrorCode; message: string } {
  if (error instanceof McpToolError) {
    return { code: error.code, message: error.message };
  }
  // Never leak stack traces or internal details to the client.
  console.error("[mcp] unhandled tool error:", error);
  return { code: "INTERNAL_ERROR", message: "Internal error" };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
