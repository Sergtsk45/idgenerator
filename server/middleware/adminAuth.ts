/**
 * @file: adminAuth.ts
 * @description: Middleware для проверки прав администратора
 * @dependencies: telegramAuth.ts, db.ts, shared/schema.ts
 * @created: 2026-02-23
 */

import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { adminUsers } from '@shared/schema';

/**
 * Middleware requireAdmin — проверяет, является ли текущий пользователь администратором.
 *
 * Должен вызываться ПОСЛЕ telegramAuth middleware.
 *
 * В production:
 *   - Требует валидный req.telegramUser (установленный telegramAuth)
 *   - Проверяет telegram_user_id в таблице admin_users
 *   - Возвращает 403 если не admin
 *
 * В development (NODE_ENV !== 'production'):
 *   - Дополнительно принимает заголовок X-Admin-Override: true (без БД-проверки)
 *   - Позволяет тестировать admin-панель без Telegram
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const isDev = process.env.NODE_ENV === 'development';

  // Dev-override: позволяет тестировать без Telegram ТОЛЬКО в development
  if (isDev && req.headers['x-admin-override'] === 'true') {
    console.warn('[AdminAuth] DEV override: admin check bypassed via X-Admin-Override header');
    next();
    return;
  }

  // Нет telegramUser — нет доступа
  const telegramUserId = req.telegramUser?.id;
  if (!telegramUserId) {
    res.status(401).json({ error: 'Telegram authentication required' });
    return;
  }

  try {
    const adminRecord = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.telegramUserId, String(telegramUserId)))
      .limit(1);

    if (adminRecord.length === 0) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (err) {
    console.error('[AdminAuth] DB error checking admin status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
