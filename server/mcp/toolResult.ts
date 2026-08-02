/**
 * @file: toolResult.ts
 * @description: Единый builder успешного результата и ошибки MCP tool
 * @dependencies: @modelcontextprotocol/sdk, server/mcp/errors.ts
 * @created: 2026-08-02
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpToolError, MCP_ERROR_CODES } from './errors';

/**
 * Успешный результат tool. `data` сериализуется в JSON и кладётся в единственный
 * text-content блок, чтобы клиент мог детерминированно парсить ответ.
 */
export function toolSuccess(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: isRecord(data) ? data : undefined,
    isError: false,
  };
}

/**
 * Ошибка tool. Никогда не раскрывает stack trace, только стабильный код и сообщение.
 */
export function toolError(error: McpToolError | Error): CallToolResult {
  const mcpError =
    error instanceof McpToolError
      ? error
      : new McpToolError(MCP_ERROR_CODES.INTERNAL_ERROR, 'Internal error');

  const payload = {
    status: 'error' as const,
    error: {
      code: mcpError.code,
      message: mcpError.message,
      recoverable: mcpError.recoverable,
    },
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
    isError: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
      console.log(`[mcp:tool] ${toolName} user=${userId} ok=${!result.isError} durationMs=${Date.now() - startedAt}`);
      return result;
    } catch (err) {
      console.log(`[mcp:tool] ${toolName} user=${userId} ok=false durationMs=${Date.now() - startedAt} threw=true`);
      return toolError(err instanceof Error ? err : new Error('Unknown error'));
    }
  };
}
