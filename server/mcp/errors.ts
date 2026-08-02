/**
 * @file: errors.ts
 * @description: Стабильные machine-readable коды ошибок для MCP tools
 * @dependencies: none
 * @created: 2026-08-02
 */

export type McpErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class McpToolError extends Error {
  readonly code: McpErrorCode;

  constructor(code: McpErrorCode, message: string) {
    super(message);
    this.name = "McpToolError";
    this.code = code;
  }
}

export const AUTH_REQUIRED = new McpToolError(
  "AUTH_REQUIRED",
  "Authorization: Bearer <jwt> is required",
);

export const AUTH_INVALID = new McpToolError(
  "AUTH_INVALID",
  "Provided JWT is invalid, expired, or belongs to a blocked user",
);
