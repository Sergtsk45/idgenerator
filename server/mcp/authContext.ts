/**
 * @file: authContext.ts
 * @description: Извлечение проверенного пользовательского контекста для MCP tools
 * @dependencies: express, server/middleware/auth.ts, server/mcp/errors.ts
 * @created: 2026-08-02
 */

import type { Request } from 'express';
import type { TariffType } from '@shared/schema';
import { McpToolError, MCP_ERROR_CODES } from './errors';

/**
 * Проверенный контекст пользователя, доступный tool-обработчикам.
 * Никогда не строится из аргументов tool — только из req.user, установленного
 * authMiddleware после проверки JWT.
 */
export interface McpAuthContext {
  userId: number;
  displayName: string;
  email: string | null;
  role: string;
  tariff: TariffType;
}

/**
 * Строит McpAuthContext из уже аутентифицированного Express Request.
 * Бросает McpToolError(AUTH_REQUIRED), если authMiddleware не установил req.user
 * (например, отсутствует/невалиден Bearer JWT).
 */
export function requireAuthContext(req: Request): McpAuthContext {
  const user = req.user;
  if (!user) {
    throw new McpToolError(MCP_ERROR_CODES.AUTH_REQUIRED, 'Authentication required');
  }

  return {
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    tariff: user.tariff,
  };
}
