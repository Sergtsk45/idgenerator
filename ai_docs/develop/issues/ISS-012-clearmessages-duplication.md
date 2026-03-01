# Issue: Дублирование вызовов storage.clearMessages()

**ID:** ISS-012  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Low  
**Status:** Open  

## Description

Метод `storage.clearMessages(req.user!.id)` вызывается в трёх местах при удалении связанных сущностей:

1. `server/routes.ts:667` - при удалении work collection
2. `server/routes.ts:728` - при удалении estimate
3. `server/routes.ts:787` - при удалении works

```typescript
await storage.deleteWorkCollection(id, { resetScheduleIfInUse: resetSchedule });
await storage.clearMessages(req.user!.id); // Дублируется
```

## Why Not Fixed Now

- Не критично для функциональности
- Код работает корректно
- Требует изменения архитектуры (cascade или hooks)
- Может быть преднамеренное поведение (business logic)

## Proposed Solution

### Вариант 1: Database CASCADE

Если messages должны удаляться автоматически при удалении works/estimates, настроить CASCADE на уровне БД:

```sql
ALTER TABLE messages 
ADD CONSTRAINT messages_work_id_fk 
FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE;
```

**Плюсы:** Автоматически, БД гарантирует consistency  
**Минусы:** Требует схемы связи message → work

### Вариант 2: Event-based cleanup

Создать event emitter для data changes:

```typescript
// server/events.ts
export const dataEvents = new EventEmitter();

// В storage.ts
async deleteWorkCollection(id: number) {
  await db.delete(workCollections).where(eq(workCollections.id, id));
  dataEvents.emit('workCollection.deleted', { id });
}

// В routes.ts (один раз)
dataEvents.on('workCollection.deleted', async ({ id }) => {
  await storage.clearMessages(userId); // Нужен userId
});
```

**Плюсы:** Decoupled logic  
**Минусы:** Сложнее debugging

### Вариант 3: Переместить в storage layer

```typescript
// server/storage.ts
async deleteWorkCollection(id: number, userId: number, options?) {
  await db.delete(workCollections).where(eq(workCollections.id, id));
  
  // Автоматически очищаем связанные messages
  await this.clearMessages(userId);
}
```

**Плюсы:** Логика в одном месте  
**Минусы:** Storage layer знает о business logic

## Priority

P5 (низкий приоритет - косметическая проблема)

## Estimated Effort

30 минут (если выбрать вариант 3)

## Related Files

- server/routes.ts
- server/storage.ts

## Notes

Возможно, это преднамеренное дублирование для явности. Нужно выяснить business logic: 
- Почему messages очищаются при удалении works?
- Должны ли они очищаться автоматически?
