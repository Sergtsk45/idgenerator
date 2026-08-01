# Issue: Сортировка карточек актов по возрастанию номера

**ID:** ISS-016  
**Discovered:** 2026-08-01  
**Reported by:** Sergey (product feedback)  
**Severity:** Low (UX)  
**Type:** Enhancement / Tech debt  
**Status:** Open  

## Description

На вкладке **Акты** карточки сейчас идут в порядке, который воспринимается как **убывание** номера акта (10 → 9 → 8 → 7 …). Нужно расположить карточки в порядке **возрастания** номера акта (1 → 2 → 3 → … → 10).

## Current Behavior

Список актов объекта отдаётся/показывается так, что сверху оказываются большие номера.  
В коде `storage.getActs(objectId)` сейчас: `.orderBy(desc(acts.createdAt))` — при генерации актов с растущим `actNumber` это визуально совпадает с убыванием № акта.

## Expected Behavior

- Карточки на вкладке Акты отсортированы по **возрастанию** `actNumber` (ASC).
- Акты без номера (`actNumber IS NULL`) — в конце списка (или по согласованному fallback, например `id`).
- Стабильный порядок при одинаковых номерах: tie-breaker по `id` ASC.

## Why Not Fixed Now

- Не блокирует работу с актами (карточки доступны, поиск/скролл есть).
- Однострочное/маленькое изменение, но стоит проверить все потребители `getActs` (генерация актов из графика, messages/section3 и т.д.) — не сломать логику, которая ожидает «последние сверху».

## Proposed Solution

**Вариант A (предпочтительный):** в `storage.getActs` сменить сортировку на `asc(acts.actNumber)` (+ tie-breaker `asc(acts.id)`), NULLS LAST.

**Вариант B:** оставить API как есть, сортировать только в UI `Acts.tsx` — если другие вызовы `getActs` должны оставаться «новые сверху».

Перед правкой: быстро проверить callers `getActs` / `GET /api/acts` и выбрать A или B.

## Priority

P3 (UX polish)

## Estimated Effort

15–60 минут (смена orderBy или client sort + smoke на списке актов)

## Related Files

- `server/storage.ts` — `getActs`
- `client/src/pages/Acts.tsx` — отображение списка
- `server/routes/acts.ts`
- возможно: `server/routes/schedule.ts` (generate-acts), `server/routes/messages.ts`

## Acceptance Criteria (когда возьмём в работу)

- [ ] На вкладке Акты карточки идут 1, 2, 3 … N (по `actNumber` ASC).
- [ ] Нет регрессий в сценариях, зависящих от порядка `getActs` (или сортировка только в UI — задокументировано).
- [ ] Smoke: объект с несколькими актами, в т.ч. с «дырами» в нумерации.
