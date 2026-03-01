/**
 * @file: telegramAuth.ts
 * @description: Middleware для валидации Telegram WebApp initData
 * @dependencies: crypto (Node.js built-in), auth-service
 * @created: 2026-02-20
 * @updated: 2026-03-01
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authService } from '../auth-service';

/**
 * Данные пользователя Telegram, извлечённые из initData
 */
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

/**
 * Расширение Express Request для добавления данных Telegram
 */
declare global {
  namespace Express {
    interface Request {
      telegramUser?: TelegramUser;
      telegramInitData?: Record<string, string>;
      user?: {
        id: number;
        displayName: string;
        email: string | null;
        role: string;
      };
    }
  }
}

/**
 * Валидирует Telegram WebApp initData согласно документации:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * 
 * Алгоритм:
 * 1. Извлечь hash из initData
 * 2. Создать data_check_string из остальных параметров (отсортированных по ключу)
 * 3. Вычислить secret_key = HMAC-SHA-256(bot_token, "WebAppData")
 * 4. Вычислить hash = HMAC-SHA-256(secret_key, data_check_string)
 * 5. Сравнить вычисленный hash с переданным
 */
function validateTelegramInitData(initData: string, botToken: string): boolean {
  try {
    // Парсим initData в URLSearchParams
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return false;
    }

    // Удаляем hash из параметров
    params.delete('hash');

    // Создаём data_check_string: сортируем параметры по ключу и объединяем через \n
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Вычисляем secret_key = HMAC-SHA-256("WebAppData", bot_token)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Вычисляем hash = HMAC-SHA-256(secret_key, data_check_string)
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Сравниваем хеши (constant-time comparison для защиты от timing attacks)
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(computedHash, 'hex')
    );
  } catch (error) {
    console.error('[TelegramAuth] Validation error:', error);
    return false;
  }
}

/**
 * Парсит данные пользователя из initData
 */
function parseUserFromInitData(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    
    if (!userJson) {
      return null;
    }

    const user = JSON.parse(userJson) as TelegramUser;
    
    // Валидация обязательных полей
    if (!user.id || !user.first_name) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('[TelegramAuth] Parse user error:', error);
    return null;
  }
}

/**
 * Middleware для валидации Telegram WebApp initData
 * 
 * Извлекает initData из:
 * 1. Заголовка X-Telegram-Init-Data (приоритет)
 * 2. Тела запроса (req.body.initData)
 * 
 * При успешной валидации добавляет в req:
 * - req.telegramUser - данные пользователя Telegram
 * - req.telegramInitData - все параметры initData
 * - req.user - унифицированный user из базы данных
 * 
 * При ошибке валидации возвращает 401 Unauthorized
 * 
 * @param options.required - если false, пропускает запросы без initData (для опциональной аутентификации)
 */
export function telegramAuthMiddleware(options: { required?: boolean } = { required: true }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // Если токен не настроен:
    // - при required=false (опциональная аутентификация) просто пропускаем запрос
    // - при required=true — это ошибка конфигурации (кроме dev-режима)
    if (!botToken) {
      if (options.required === false) {
        next();
        return;
      }
      if (process.env.NODE_ENV === 'development') {
        console.warn('[TelegramAuth] TELEGRAM_BOT_TOKEN not set, skipping validation in development');
        next();
        return;
      }

      console.error('[TelegramAuth] TELEGRAM_BOT_TOKEN not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    // Извлекаем initData из заголовка или тела
    const initData = 
      req.headers['x-telegram-init-data'] as string ||
      req.body?.initData as string;

    if (!initData) {
      if (!options.required) {
        next();
        return;
      }
      
      res.status(401).json({ error: 'Telegram authentication required' });
      return;
    }

    // Проверяем auth_date (не старше 600 секунд)
    const params = new URLSearchParams(initData);
    const authDateStr = params.get('auth_date');
    
    if (authDateStr) {
      const authDate = Number(authDateStr);
      if (Number.isFinite(authDate) && !authService.validateTelegramAuthDate(authDate)) {
        res.status(401).json({ error: 'Telegram authentication data expired' });
        return;
      }
    }

    // Валидируем подпись
    const isValid = validateTelegramInitData(initData, botToken);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid Telegram authentication data' });
      return;
    }

    // Парсим данные пользователя
    const telegramUser = parseUserFromInitData(initData);

    if (!telegramUser) {
      res.status(401).json({ error: 'Invalid user data in initData' });
      return;
    }

    // Добавляем данные в request (сохраняем для обратной совместимости)
    req.telegramUser = telegramUser;
    req.telegramInitData = Object.fromEntries(params.entries());

    // Создаём или находим пользователя в базе данных
    try {
      const user = await authService.findOrCreateUserByProvider(
        'telegram',
        String(telegramUser.id),
        telegramUser as unknown as Record<string, unknown>
      );

      req.user = {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      console.error('[TelegramAuth] Failed to find/create user:', error);
      res.status(500).json({ error: 'Failed to authenticate user' });
      return;
    }

    next();
  };
}

/**
 * Утилита для создания mock initData для тестирования
 * ТОЛЬКО ДЛЯ РАЗРАБОТКИ!
 */
export function createMockInitData(user: Partial<TelegramUser>, botToken: string): string {
  const userData = {
    id: user.id || 123456789,
    first_name: user.first_name || 'Test',
    last_name: user.last_name,
    username: user.username,
    language_code: user.language_code || 'ru',
  };

  const params = new URLSearchParams();
  params.set('user', JSON.stringify(userData));
  params.set('auth_date', Math.floor(Date.now() / 1000).toString());
  params.set('query_id', 'AAHdF6IQAAAAAN0XohDhrOrc'); // mock query_id

  // Создаём data_check_string
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Вычисляем secret_key и hash
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  params.set('hash', hash);

  return params.toString();
}
