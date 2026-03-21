/**
 * @file: auth.ts
 * @description: API endpoints для аутентификации (регистрация, логин, JWT)
 * @dependencies: express, express-rate-limit, auth-service, shared/routes
 * @created: 2026-03-01
 */

import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { authService } from '../auth-service';
import { authMiddleware } from '../middleware/auth';
import { telegramAuthMiddleware } from '../middleware/telegramAuth';
import { db } from '../db';
import { authProviders, users } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts, please try again later' },
});

const DEFAULT_DEV_ADMIN_EMAIL = 'admin@admin.com';
const DEFAULT_DEV_ADMIN_PASSWORD = '12345678';
const DEFAULT_DEV_ADMIN_DISPLAY_NAME = 'Admin';

async function ensureDefaultDevAdminUser() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const existingRows = await db
    .select()
    .from(users)
    .where(eq(users.email, DEFAULT_DEV_ADMIN_EMAIL))
    .limit(1);

  let userId: number;

  if (existingRows.length === 0) {
    const passwordHash = await authService.hashPassword(DEFAULT_DEV_ADMIN_PASSWORD);
    const [newUser] = await db
      .insert(users)
      .values({
        displayName: DEFAULT_DEV_ADMIN_DISPLAY_NAME,
        email: DEFAULT_DEV_ADMIN_EMAIL,
        passwordHash,
        role: 'admin',
        isBlocked: false,
        tariff: 'standard',
        trialUsed: true,
      })
      .returning();

    userId = newUser.id;
    console.info(`[Auth] Created default dev admin: ${DEFAULT_DEV_ADMIN_EMAIL}`);
  } else {
    const existingUser = existingRows[0];

    if (existingUser.role !== 'admin') {
      console.warn(
        `[Auth] Skipped default dev admin bootstrap: ${DEFAULT_DEV_ADMIN_EMAIL} already exists and is not an admin`
      );
      return;
    }

    userId = existingUser.id;

    const passwordMatches =
      !!existingUser.passwordHash &&
      (await authService.verifyPassword(DEFAULT_DEV_ADMIN_PASSWORD, existingUser.passwordHash));

    if (!passwordMatches || existingUser.isBlocked) {
      const passwordHash = await authService.hashPassword(DEFAULT_DEV_ADMIN_PASSWORD);

      await db
        .update(users)
        .set({
          passwordHash,
          isBlocked: false,
        })
        .where(eq(users.id, userId));

      console.info(`[Auth] Refreshed default dev admin credentials: ${DEFAULT_DEV_ADMIN_EMAIL}`);
    }
  }

  const linkedEmailProviders = await db
    .select({ id: authProviders.id, externalId: authProviders.externalId })
    .from(authProviders)
    .where(
      and(
        eq(authProviders.userId, userId),
        eq(authProviders.provider, 'email')
      )
    )
    .limit(5);

  if (linkedEmailProviders.length === 0) {
    await db.insert(authProviders).values({
      userId,
      provider: 'email',
      externalId: DEFAULT_DEV_ADMIN_EMAIL,
    });
  } else if (!linkedEmailProviders.some((provider) => provider.externalId === DEFAULT_DEV_ADMIN_EMAIL)) {
    console.warn(
      `[Auth] Skipped linking default dev admin email provider: user ${userId} already has another email provider`
    );
  }
}

export async function registerAuthRoutes(app: Express) {
  await ensureDefaultDevAdminUser();

  // POST /api/auth/login/telegram — аутентификация через Telegram initData
  app.post(
    '/api/auth/login/telegram',
    loginRateLimiter,
    telegramAuthMiddleware({ required: true }),
    async (req, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication failed' });
        }

        const jwt = await authService.generateJWT(req.user.id, req.user.role);

        // Получаем полные данные пользователя для возврата tariff полей
        const userDetails = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
        const user = userDetails[0];

        return res.status(200).json({
          user: {
            id: user.id,
            displayName: user.displayName,
            email: user.email,
            role: user.role,
            tariff: user.tariff,
            subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() || null,
            trialUsed: user.trialUsed,
          },
          token: jwt,
        });
      } catch (error) {
        console.error('[Auth] Login via Telegram failed:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // POST /api/auth/register — регистрация через email/password
  app.post('/api/auth/register', registerRateLimiter, async (req, res) => {
    try {
      const schema = z.object({
        displayName: z.string().min(2, 'Display name must be at least 2 characters'),
        email: z.string().email('Invalid email format'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.errors,
        });
      }

      const { displayName, email, password } = parsed.data;

      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await authService.hashPassword(password);

      // Автоматическая активация Trial для новых пользователей (14 дней)
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const [newUser] = await db
        .insert(users)
        .values({
          displayName,
          email,
          passwordHash,
          role: 'user',
          isBlocked: false,
          tariff: 'standard',
          subscriptionEndsAt: trialEndsAt,
          trialUsed: true,
        })
        .returning();

      await authService.linkProvider(newUser.id, 'email', email);

      const jwt = await authService.generateJWT(newUser.id, newUser.role);

      return res.status(201).json({
        user: {
          id: newUser.id,
          displayName: newUser.displayName,
          email: newUser.email,
          role: newUser.role,
          tariff: newUser.tariff,
          subscriptionEndsAt: newUser.subscriptionEndsAt?.toISOString() || null,
          trialUsed: newUser.trialUsed,
        },
        token: jwt,
      });
    } catch (error) {
      console.error('[Auth] Registration failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/login — вход через email/password
  app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(1, 'Password is required'),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.errors,
        });
      }

      const { email, password } = parsed.data;

      const user = await authService.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const userRecord = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      if (userRecord.length === 0 || !userRecord[0].passwordHash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await authService.verifyPassword(
        password,
        userRecord[0].passwordHash
      );

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.isBlocked) {
        return res.status(403).json({ error: 'User is blocked' });
      }

      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      const jwt = await authService.generateJWT(user.id, user.role);

      // Получаем полные данные пользователя для возврата tariff полей
      const fullUserData = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      const userData = fullUserData[0];

      return res.status(200).json({
        user: {
          id: userData.id,
          displayName: userData.displayName,
          email: userData.email,
          role: userData.role,
          tariff: userData.tariff,
          subscriptionEndsAt: userData.subscriptionEndsAt?.toISOString() || null,
          trialUsed: userData.trialUsed,
        },
        token: jwt,
      });
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/auth/me — информация о текущем пользователе
  app.get('/api/auth/me', authMiddleware({ required: true }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Получаем полные данные пользователя для возврата tariff полей
      const userDetails = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
      
      if (userDetails.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userDetails[0];

      return res.status(200).json({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        tariff: user.tariff,
        subscriptionEndsAt: user.subscriptionEndsAt?.toISOString() || null,
        trialUsed: user.trialUsed,
      });
    } catch (error) {
      console.error('[Auth] Get current user failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/link-email — безопасная привязка email с хешированием пароля
  app.post('/api/auth/link-email', authMiddleware({ required: true }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const schema = z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.errors,
        });
      }

      const { email, password } = parsed.data;

      // Проверяем, что email еще не используется
      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Хешируем пароль на сервере
      const passwordHash = await authService.hashPassword(password);

      // Обновляем пользователя
      await db
        .update(users)
        .set({
          email,
          passwordHash,
        })
        .where(eq(users.id, req.user.id));

      // Привязываем провайдера email
      await authService.linkProvider(req.user.id, 'email', email);

      return res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already linked')) {
          return res.status(409).json({ error: error.message });
        }
      }
      console.error('[Auth] Link email failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/link-provider — привязка дополнительного провайдера
  app.post('/api/auth/link-provider', authMiddleware({ required: true }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const schema = z.object({
        provider: z.enum(['telegram', 'email', 'phone']),
        externalId: z.string().min(1),
        metadata: z.record(z.unknown()).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.errors,
        });
      }

      const { provider, externalId, metadata } = parsed.data;

      await authService.linkProvider(req.user.id, provider, externalId, metadata);

      return res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already linked')) {
          return res.status(409).json({ error: error.message });
        }
      }
      console.error('[Auth] Link provider failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
}
