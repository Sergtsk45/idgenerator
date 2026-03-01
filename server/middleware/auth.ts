/**
 * @file: auth.ts
 * @description: Унифицированный middleware для проверки аутентификации из разных источников
 * @dependencies: express, auth-service, telegramAuth
 * @created: 2026-03-01
 */

import type { Request, Response, NextFunction } from 'express';
import { authService } from '../auth-service';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        displayName: string;
        email: string | null;
        role: string;
      };
    }
  }
}

export function authMiddleware(options?: { required?: boolean }) {
  const required = options?.required !== false;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let userId: number | null = null;
      let authMethod: string | null = null;

      // Приоритет 1: Authorization: Bearer <jwt>
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = await authService.verifyJWT(token);
        
        if (payload) {
          userId = payload.sub;
          authMethod = 'jwt';
        }
      }

      // Приоритет 2: X-Telegram-Init-Data
      if (!userId) {
        const telegramInitData = req.headers['x-telegram-init-data'] as string;
        
        if (telegramInitData && req.telegramUser) {
          const telegramUserId = String(req.telegramUser.id);
          const user = await authService.findOrCreateUserByProvider(
            'telegram',
            telegramUserId,
            req.telegramUser as unknown as Record<string, unknown>
          );
          
          userId = user.id;
          authMethod = 'telegram';
        }
      }

      // Приоритет 3: X-App-Access-Token (legacy, dev-only)
      if (!userId && req.telegramUser?.id === -1 && process.env.NODE_ENV === 'development') {
        const user = await authService.findOrCreateUserByProvider(
          'telegram',
          '-1',
          { first_name: 'Browser', is_dev: true }
        );
        
        userId = user.id;
        authMethod = 'browser-token';
      }

      if (!userId) {
        if (required) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        return next();
      }

      const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (userRecord.length === 0) {
        if (required) {
          return res.status(401).json({ error: 'User not found' });
        }
        return next();
      }

      const user = userRecord[0];

      if (user.isBlocked) {
        return res.status(403).json({ error: 'User is blocked' });
      }

      req.user = {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      };

      if (authMethod === 'jwt') {
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, userId));
      }

      next();
    } catch (error) {
      console.error('[AuthMiddleware] Error:', error);
      
      if (required) {
        return res.status(401).json({ error: 'Authentication failed' });
      }
      
      next();
    }
  };
}
