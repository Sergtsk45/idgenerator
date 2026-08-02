/**
 * @file: errors.ts
 * @description: Стабильные машинно-читаемые коды ошибок MCP tools
 * @dependencies: none
 * @created: 2026-08-02
 */

export const MCP_ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  WORKFLOW_VERSION_CONFLICT: 'WORKFLOW_VERSION_CONFLICT',
  WORKFLOW_TRANSITION_NOT_ALLOWED: 'WORKFLOW_TRANSITION_NOT_ALLOWED',
} as const;

export type McpErrorCode = (typeof MCP_ERROR_CODES)[keyof typeof MCP_ERROR_CODES];

/**
 * Ошибка MCP tool с машинно-читаемым кодом. Никогда не должна нести stack trace
 * или чувствительные данные во внешний ответ — только code/message/recoverable.
 */
export class McpToolError extends Error {
  readonly code: McpErrorCode;
  readonly recoverable: boolean;

  constructor(code: McpErrorCode, message: string, options?: { recoverable?: boolean }) {
    super(message);
    this.name = 'McpToolError';
    this.code = code;
    this.recoverable = options?.recoverable ?? false;
  }
}
