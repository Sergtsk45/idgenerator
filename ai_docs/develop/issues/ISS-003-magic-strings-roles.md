# Issue: Magic strings for user roles

**ID:** ISS-003  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Low  
**Status:** Open  

## Description

Роли пользователей ('user', 'admin') используются как строковые литералы по всему коду:

**Примеры:**
- `shared/schema.ts:28`: `role: text("role").notNull().default("user")`
- `server/auth-service.ts:134`: `role: 'user'`
- `server/middleware/adminAuth.ts:34`: `req.user.role !== 'admin'`
- `migrations/0018:21`: `CHECK (role IN ('user', 'admin'))`

## Why Not Fixed Now

- Не критично для функциональности
- Требует обновления миграции
- Риск опечаток минимален (TypeScript + CHECK constraint)

## Proposed Solution

Создать enum в `shared/schema.ts`:

```typescript
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// В определении таблицы:
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  role: text("role").notNull().default(USER_ROLES.USER),
  // ...
}, (t) => ({
  roleCheck: check(
    "users_role_check", 
    sql`role IN (${sql.raw(`'${USER_ROLES.USER}', '${USER_ROLES.ADMIN}'`)})`
  ),
}));
```

Обновить все места использования:
- `server/auth-service.ts`
- `server/middleware/adminAuth.ts`
- `server/routes/auth.ts`

## Priority

P5 (low priority tech debt)

## Estimated Effort

30 минут

## Related Files

- shared/schema.ts
- server/auth-service.ts
- server/middleware/auth.ts
- server/middleware/adminAuth.ts
