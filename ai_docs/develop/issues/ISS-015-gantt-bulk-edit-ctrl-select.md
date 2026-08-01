# Issue: Массовое назначение параметров задач Gantt (Ctrl+multi-select)

**ID:** ISS-015  
**Discovered:** 2026-08-01  
**Reported by:** Sergey (product feedback)  
**Severity:** Medium (UX / productivity)  
**Type:** Feature / Tech debt  
**Status:** Open  

## Description

На экране Schedule (диаграмма Ганта) нужно уметь **массово** менять параметры у нескольких задач сразу. С зажатым **Ctrl** пользователь выбирает задачи (типичный сценарий — задачи с одинаковым номером акта) и одним действием задаёт общие значения полей.

## Scope параметров (v1)

| Параметр | Поле / смысл |
|----------|----------------|
| Номер акта | `actNumber` (или эквивалент в UI) |
| Тип акта | тип/вид акта |
| Дата начала | start date задачи |
| Длительность | duration задачи |

## Current Behavior

Параметры редактируются по одной задаче (модалка / inline). Нет multi-select и bulk update.

## Expected Behavior

1. **Ctrl + click** по задаче — добавить/снять задачу из множественного выделения.
2. Выделенные задачи визуально отличаются (highlight / checkbox / outline).
3. При наличии выделения доступно действие «изменить параметры» (панель / модалка / контекстное меню).
4. Указанные значения применяются ко **всем** выделенным задачам одним сохранением (batch API или последовательные patch с одной UX-операцией).
5. Типичный use-case: выбрать задачи с одним номером акта и массово сменить номер/тип акта, дату начала или длительность.
6. Без Ctrl — прежнее поведение (одиночный выбор / открытие задачи).

## Why Not Fixed Now

- Не блокирует базовый сценарий планирования.
- Нужны: multi-select state, UI bulk-edit, валидация конфликтов, желательно batch endpoint или аккуратный multi-patch.
- Стоит уточнить edge cases (разные object/schedule, locked/completed tasks, split siblings) перед реализацией.

## Open Questions (перед взятием в работу)

- Ограничивать ли multi-select только задачами с **одинаковым** текущим `actNumber`, или Ctrl позволяет выделять любые задачи?
- Shift+click range select — в v1 или позже?
- Что делать, если у части выделенных задач поле read-only / уже в акте / просрочено?
- Touch / tablet: аналог Ctrl (long-press / checkbox mode)?

## Proposed Solution

1. State: `selectedTaskIds: Set<string>` + обработчики Ctrl+click на строке/полосе Gantt.
2. Bulk-edit UI: форма с полями номер акта, тип акта, дата начала, длительность (пустые = «не менять»).
3. Persist: один batch PATCH или N× `PATCH schedule-tasks` под одной транзакцией/оптимистичным UI.
4. После успеха — сброс выделения или сохранение выделения; toast с числом обновлённых задач.
5. Smoke: несколько задач одного акта → смена номера/типа/дат → проверка полос и списка актов.

## Priority

P3 (productivity UX; взять после стабилизации текущего Gantt)

## Estimated Effort

1–2 дня (UI multi-select + bulk form + API/валидация + smoke), зависит от batch API и edge cases.

## Related Files

- `client/src/pages/Schedule.tsx`
- `server/routes/schedule.ts` (schedule-tasks patch)
- `docs/techspec_schedule.md`
- `docs/TZfrontend/04-schedule-acts.md`

## Acceptance Criteria (когда возьмём в работу)

- [ ] Ctrl+click добавляет/снимает задачу из выделения; без Ctrl — одиночный сценарий без регрессий.
- [ ] Визуально видно, какие задачи выделены.
- [ ] Bulk-edit меняет у всех выделенных: номер акта, тип акта, дату начала, длительность (только заполненные в форме поля).
- [ ] Ошибки валидации не оставляют часть задач в полуобновлённом состоянии без понятного сообщения (или явно документированный partial success).
- [ ] Smoke на типичном сценарии «задачи одного номера акта».
