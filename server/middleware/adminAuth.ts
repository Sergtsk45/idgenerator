/**
 * @file: adminAuth.ts
 * @description: Middleware для проверки прав администратора
 * @dependencies: auth.ts
 * @created: 2026-02-23
 * @updated: 2026-03-01
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware requireAdmin — проверяет, является ли текущий пользователь администратором.
 *
 * Должен вызываться ПОСЛЕ authMiddleware.
 *
 * Проверяет req.user?.role === 'admin'
 * Возвращает 403 если не admin
 *
 * В development (NODE_ENV !== 'production'):
 *   - Дополнительно принимает заголовок X-Admin-Override: true (без проверки)
 *   - Позволяет тестировать admin-панель без аутентификации
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const isDev = process.env.NODE_ENV === 'development';

  // Dev-override: позволяет тестировать без Telegram ТОЛЬКО в development
  if (isDev && req.headers['x-admin-override'] === 'true') {
    console.warn('[AdminAuth] DEV override: admin check bypassed via X-Admin-Override header');
    next();
    return;
  }

  // Проверяем, что пользователь аутентифицирован и является админом
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}
