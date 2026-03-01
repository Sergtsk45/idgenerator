# Issue: routes.ts violates Single Responsibility Principle

**ID:** ISS-002  
**Discovered:** 2026-03-01 (during multi-auth code review)  
**Reported by:** review agent  
**Severity:** Medium  
**Status:** Open  

## Description

Файл `server/routes.ts` содержит 2426 строк кода и регистрирует endpoints для:
- Authentication (auth routes)
- Works (BoQ)
- Work Collections
- Estimates
- Messages
- Acts
- Schedules
- Materials & Documents
- Admin API

Это нарушает принцип Single Responsibility и затрудняет:
- Навигацию по коду
- Code review
- Тестирование
- Параллельную разработку

## Why Not Fixed Now

- Требует значительного рефакторинга
- Может создать конфликты слияния
- Текущая задача (multi-auth) завершается
- Функциональность работает корректно

## Proposed Solution

Разбить на модули по доменам:

```
server/routes/
├── auth.ts          (уже создан)
├── works.ts         (BoQ, collections)
├── estimates.ts     (LSR, positions)
├── materials.ts     (materials, documents, bindings)
├── messages.ts      (messages, worklog)
├── acts.ts          (acts, export, pdf)
├── schedule.ts      (schedules, tasks)
└── admin.ts         (admin API)
```

Каждый модуль экспортирует функцию `register<Feature>Routes(app: Express)`.

## Priority

P3 (important tech debt, schedule for next refactoring sprint)

## Estimated Effort

2-3 часа (с учётом тестирования)

## Related Files

- server/routes.ts (основной файл для рефакторинга)
- server/routes/auth.ts (пример уже выделенного модуля)
