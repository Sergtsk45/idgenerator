# Issue: Отсутствует блокировка аккаунта после неудачных попыток входа

**ID:** ISS-004  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Medium  
**Status:** Open  

## Description

В системе реализован rate limiting по IP (5 попыток в минуту), но нет защиты от brute-force атак на конкретный аккаунт:

- Атакующий может использовать разные IP (VPN, proxies)
- Нет счётчика неудачных попыток на уровне аккаунта
- Нет временной блокировки после N неудачных попыток

## Why Not Fixed Now

- Не блокирует текущую разработку
- Rate limiting по IP обеспечивает базовую защиту
- Требует изменения схемы БД (новые поля)
- Для MVP достаточно текущей защиты

## Proposed Solution

### 1. Обновить схему users:

```typescript
export const users = pgTable("users", {
  // ... existing fields
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
});
```

### 2. Добавить миграцию:

```sql
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;
```

### 3. Обновить login логику:

```typescript
// Проверка блокировки
if (user.lockedUntil && user.lockedUntil > new Date()) {
  return res.status(403).json({ 
    error: 'Account temporarily locked. Try again later.' 
  });
}

// При неудачной попытке
const attempts = user.failedLoginAttempts + 1;
if (attempts >= 5) {
  await db.update(users).set({
    failedLoginAttempts: attempts,
    lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 минут
  }).where(eq(users.id, user.id));
  
  return res.status(403).json({ 
    error: 'Too many failed attempts. Account locked for 15 minutes.' 
  });
}

await db.update(users).set({
  failedLoginAttempts: attempts
}).where(eq(users.id, user.id));

// При успешном входе - сброс счётчика
await db.update(users).set({
  failedLoginAttempts: 0,
  lockedUntil: null
}).where(eq(users.id, user.id));
```

## Priority

P3 (важно для production, но не блокирует MVP)

## Estimated Effort

1 час (миграция + логика + тестирование)

## Related Files

- shared/schema.ts
- server/routes/auth.ts
- migrations/ (новая миграция)

## References

- OWASP: [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#account-lockout)
