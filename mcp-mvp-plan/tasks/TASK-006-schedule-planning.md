# TASK-006: Schedule planning engine, draft и approval

## Метаданные

- **Тип:** implementation task
- **Зависимости:** TASK-004, TASK-005
- **Результат:** Рассчитать воспроизводимый линейный график по смете и сохранить утверждённую версию в существующие schedules/schedule_tasks.

## Задание агенту

### Роль

Ты — senior TypeScript backend engineer, работающий в существующем репозитории `Sergtsk45/idgenerator`. Твоя задача — выполнить только описанный scope, сохранив совместимость существующего приложения.

### Цель

Рассчитать воспроизводимый линейный график по смете и сохранить утверждённую версию в существующие schedules/schedule_tasks.

### Контекст

MVP поддерживает простую модель, но обязан показывать основания расчёта и не выдумывать производительность.

### Связанные файлы для первичного изучения

- `server/routes/schedule.ts`
- schedule methods в `server/storage.ts`
- `shared/schema.ts`: schedules, scheduleTasks
- estimate analysis
- workflow inputs
- date helpers

Список не является исчерпывающим. Найди фактические зависимости через импорты, схемы и тесты.

### Обязательные первые действия

1. Прочитай все применимые `AGENTS.md`, `.cursor/rules`, ADR и документацию.
2. Изучи текущий код и существующие тесты; не предполагай отсутствующие контракты.
3. Дай краткий план из 3–7 пунктов.
4. Зафиксируй найденные риски и несовместимости до редактирования.
5. Не начинай широкий рефакторинг без необходимости для acceptance criteria.

### Scope

1. Создай pure planning core.
2. Реализуй calendars 5x2 и 6x1.
3. Target-duration mode: распределение дней по формальным весам.
4. Crew-size mode: только при labor coverage согласно утверждённому порогу.
5. Добавь assumptions и confidence/warnings.
6. Сохраняй versioned schedule draft с input hash.
7. MCP `calculate_schedule_draft`, `get_schedule_draft`.
8. MCP `approve_schedule`.
9. Approval создаёт/обновляет schedule и tasks транзакционно.
10. Повторное approval одной версии идемпотентно.
11. Existing schedule generation routes должны использовать общие services, где уместно.

### Non-goals

- Не реализовывать CPM.
- Не планировать параллельные работы.
- Не учитывать несколько бригад.
- Не оптимизировать стоимость.
- Не назначать act templates автоматически.

### Обязательные контракты

- Минимум 1 рабочий день на main work.
- Общий target duration соблюдается либо возвращается явное rounding warning.
- Нерабочие дни пропускаются.
- Task order соответствует main estimate positions.
- Draft нельзя approve, если input hash устарел.
- Error codes: `SCHEDULE_INPUTS_INCOMPLETE`, `LABOR_DATA_REQUIRED`, `SCHEDULE_DRAFT_STALE`, `SCHEDULE_APPROVAL_CONFLICT`.

### Безопасность и качество

- Всегда получать user identity из проверенного auth context.
- Не принимать доверенный `userId` из tool arguments.
- Проверять ownership всех object/workflow/entity ID.
- Для write-операций предусмотреть идемпотентность или доказать, почему она не нужна.
- Не логировать токены, содержимое секретов и полные персональные данные.
- Возвращать стабильные машинно-читаемые error codes.
- Сохранить обратную совместимость текущих REST-сценариев.
- Переиспользовать Zod и domain services вместо дублирования правил.
- Не скрывать ошибки тестов; устранить или явно описать блокер.

### Acceptance criteria

- Известный fixture даёт ожидаемые даты.
- Weekend tests.
- Target duration sum test.
- Crew formula test.
- Stale draft cannot approve.
- Approval creates tasks linked to estimate positions.
- Retry does not duplicate tasks.

### Проверки

- Pure unit tests planning core.
- Property-style invariants: positive durations, ordered dates.
- Integration transaction/approval.
- Regression existing schedule tests.

Обязательно выполнить:

```bash
npm run check
npm test
npm run build
```

### Риски и особые замечания

Не маскировать низкое качество исходных данных. Любое fallback-взвешивание должно попасть в warnings и assumptions.

### Формат финального отчёта

1. Краткий результат.
2. Изменённые файлы.
3. Миграции и совместимость.
4. Добавленные/изменённые контракты.
5. Тесты и фактические результаты команд.
6. Ручной smoke-сценарий.
7. Известные ограничения.
8. Следующая зависимая TASK.
