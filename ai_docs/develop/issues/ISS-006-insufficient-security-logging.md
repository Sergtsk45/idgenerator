# Issue: Недостаточное логирование security events

**ID:** ISS-006  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Medium  
**Status:** Open  

## Description

Текущее логирование security событий минимально. Не логируются:

**Критичные события:**
- ❌ Неудачные попытки входа (для обнаружения brute-force)
- ❌ Успешные входы с IP и user agent
- ❌ JWT verification failures
- ❌ Telegram auth date expiration
- ❌ Account lockouts (когда будет реализовано)
- ❌ Admin actions (make-admin, block-user)
- ❌ Provider linking/unlinking

**Текущее логирование:**
- ✅ JWT verification errors: `console.error('[AuthService] JWT verification failed:', error)`
- ✅ Generic errors: `console.error('[Auth] Login failed:', error)`

## Why Not Fixed Now

- Не блокирует функциональность
- Требует настройки structured logging библиотеки
- Нужно определить формат логов и storage
- Для MVP достаточно console.error

## Proposed Solution

### 1. Установить winston или pino:

```bash
npm install winston
```

### 2. Создать `server/logger.ts`:

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/security.log',
      level: 'info'
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});
```

### 3. Добавить security event logging:

```typescript
// В server/routes/auth.ts
// Успешный вход
logger.info('auth.login.success', {
  userId: user.id,
  email: user.email,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString()
});

// Неудачная попытка
logger.warn('auth.login.failed', {
  email: email,
  reason: 'invalid_credentials',
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString()
});

// JWT verification failure
logger.warn('auth.jwt.verification_failed', {
  error: error.message,
  ip: req.ip,
  timestamp: new Date().toISOString()
});
```

### 4. Настроить log rotation:

```typescript
import 'winston-daily-rotate-file';

new winston.transports.DailyRotateFile({
  filename: 'logs/security-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d'
});
```

## Priority

P3 (важно для production мониторинга и security audits)

## Estimated Effort

2 часа (setup + интеграция + тестирование)

## Related Files

- server/routes/auth.ts
- server/middleware/auth.ts
- server/middleware/telegramAuth.ts
- server/auth-service.ts
- server/logger.ts (новый файл)

## Related Issues

- ISS-004 (account lockout требует логирования для работы)

## References

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
