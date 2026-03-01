# Issue: Избыточное использование TypeScript `any`

**ID:** ISS-010  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Low  
**Status:** Open  

## Description

В `server/routes.ts` множество мест с кастингом `as any` для обхода типов:

**Примеры:**
```typescript
// Строка 203
const created = await storage.createMaterialCatalog(input as any);

// Строка 236
const created = await storage.createProjectMaterial(objectId, {
  catalogMaterialId: (input as any).catalogMaterialId ?? null,
  // ...
} as any);

// Строка 422
const created = await storage.createBatch(projectMaterialId, input as any);

// И многие другие...
```

## Why Not Fixed Now

- Код компилируется и работает
- Типы в storage.ts могут быть несовместимы с Zod схемами
- Требует ревизии всех типов в IStorage interface
- Не влияет на runtime безопасность

## Proposed Solution

### Вариант 1: Синхронизировать типы storage с Zod схемами

Обновить `server/storage.ts` типы для соответствия API контрактам из `shared/routes.ts`:

```typescript
// В shared/routes.ts уже есть Zod схемы
const createMaterialInput = z.object({
  name: z.string(),
  category: z.string().optional(),
  // ...
});

// В server/storage.ts использовать те же типы
import type { z } from 'zod';
import { api } from '@shared/routes';

interface IStorage {
  createMaterialCatalog(
    material: z.infer<typeof api.materialsCatalog.create.input>
  ): Promise<MaterialCatalog>;
}
```

### Вариант 2: Создать адаптеры между Zod и Drizzle типами

```typescript
// shared/adapters.ts
export function adaptMaterialInput(
  zodInput: z.infer<typeof api.materialsCatalog.create.input>
): InsertMaterialCatalog {
  return {
    name: zodInput.name,
    category: zodInput.category || null,
    // ... explicit mapping
  };
}

// В routes.ts
const input = api.materialsCatalog.create.input.parse(req.body);
const adapted = adaptMaterialInput(input);
const created = await storage.createMaterialCatalog(adapted);
```

## Priority

P4 (code quality improvement, не критично)

## Estimated Effort

3-4 часа (ревизия всех типов + адаптеры + тестирование)

## Related Files

- server/routes.ts (основной файл с `as any`)
- server/storage.ts (интерфейс IStorage)
- shared/routes.ts (Zod схемы)

## Benefits

- Лучшая type safety
- Раннее обнаружение ошибок (compile time)
- Улучшенный IntelliSense
- Легче рефакторинг
