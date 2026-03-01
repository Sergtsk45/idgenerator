# Issue: AuthService не использует Dependency Injection

**ID:** ISS-008  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Low  
**Status:** Open  

## Description

`AuthService` напрямую импортирует `db` и таблицы из схемы:

```typescript
import { db } from './db';
import { users, authProviders } from '@shared/schema';
```

Это затрудняет:
- Unit тестирование (нельзя подменить db mock)
- Использование разных баз данных
- Изоляцию при тестировании

## Why Not Fixed Now

- Не блокирует текущую функциональность
- Тесты пока не реализованы
- Требует рефакторинга создания instance
- Для MVP приемлемо

## Proposed Solution

### 1. Обновить AuthService для DI:

```typescript
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@shared/schema';

export class AuthService {
  constructor(
    private db: NodePgDatabase<typeof schema>,
    private tables: {
      users: typeof schema.users;
      authProviders: typeof schema.authProviders;
    }
  ) {}
  
  async findOrCreateUserByProvider(
    provider: 'telegram' | 'email' | 'phone',
    externalId: string,
    metadata?: Record<string, unknown>
  ): Promise<User> {
    const existingProvider = await this.db
      .select()
      .from(this.tables.authProviders)
      .where(
        and(
          eq(this.tables.authProviders.provider, provider), 
          eq(this.tables.authProviders.externalId, externalId)
        )
      )
      .limit(1);
    
    // ...
  }
}

// В auth-service.ts экспорт singleton
export const authService = new AuthService(db, { users, authProviders });
```

### 2. Unit тесты с mock db:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth-service';

describe('AuthService', () => {
  it('should hash password with bcrypt', async () => {
    const mockDb = { /* mock implementation */ };
    const service = new AuthService(mockDb as any, mockTables);
    
    const hash = await service.hashPassword('testpass123');
    expect(hash).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt format
  });
  
  it('should generate valid JWT', async () => {
    // ...
  });
});
```

## Priority

P5 (low priority - полезно для будущих тестов)

## Estimated Effort

1 час (refactoring + update imports)

## Related Files

- server/auth-service.ts
- server/middleware/auth.ts
- server/middleware/telegramAuth.ts
- server/routes/auth.ts

## Related Issues

- Зависит от добавления test infrastructure (vitest setup)
