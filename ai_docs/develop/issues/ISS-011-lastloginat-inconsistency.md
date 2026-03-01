# Issue: lastLoginAt обновляется только для JWT

**ID:** ISS-011  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Low  
**Status:** Open  

## Description

В `server/middleware/auth.ts` поле `lastLoginAt` обновляется только при JWT аутентификации, но не при Telegram или browser-token:

```typescript
if (authMethod === 'jwt') {
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
}
```

**Проблема:**
- Несогласованность данных
- Telegram пользователи показывают устаревший lastLoginAt
- Нельзя отследить активность пользователей

## Why Not Fixed Now

- Не критично для функциональности
- lastLoginAt пока не используется в UI
- Может создать дополнительную нагрузку на БД

## Proposed Solution

### Вариант 1: Обновлять для всех методов

```typescript
// Убрать условие
await db
  .update(users)
  .set({ lastLoginAt: new Date() })
  .where(eq(users.id, userId));
```

**Плюсы:** Консистентность  
**Минусы:** Дополнительный UPDATE при каждом запросе

### Вариант 2: Обновлять только раз в сессию

```typescript
// Использовать Redis или in-memory cache
const lastUpdateKey = `last_login_update:${userId}`;
const lastUpdate = await cache.get(lastUpdateKey);

if (!lastUpdate || Date.now() - lastUpdate > 5 * 60 * 1000) { // 5 минут
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
  
  await cache.set(lastUpdateKey, Date.now(), { ttl: 300 });
}
```

**Плюсы:** Меньше нагрузки на БД  
**Минусы:** Требует cache layer

### Вариант 3: Обновлять только при login endpoints

Перенести логику обновления из middleware в `/api/auth/login` и `/api/auth/login/telegram`:

```typescript
// В server/routes/auth.ts (уже есть в строке 163)
await db
  .update(users)
  .set({ lastLoginAt: new Date() })
  .where(eq(users.id, user.id));
```

**Плюсы:** Нет overhead на каждом запросе  
**Минусы:** Показывает время последнего логина, а не последней активности

## Priority

P5 (low priority - данные не критичны)

## Estimated Effort

15 минут (выбрать вариант + реализовать)

## Related Files

- server/middleware/auth.ts
- server/routes/auth.ts
