# TASK-004: Детерминированный анализ сметы

## Метаданные

- **Тип:** implementation task
- **Зависимости:** TASK-003
- **Результат:** Создать сервис анализа импортированной сметы: основные работы, ресурсы, категории и доступность трудоёмкости.

## Задание агенту

### Роль

Ты — senior TypeScript backend engineer, работающий в существующем репозитории `Sergtsk45/idgenerator`. Твоя задача — выполнить только описанный scope, сохранив совместимость существующего приложения.

### Цель

Создать сервис анализа импортированной сметы: основные работы, ресурсы, категории и доступность трудоёмкости.

### Контекст

Schedule planner и materials workflow не должны каждый раз по-разному интерпретировать одну смету.

### Связанные файлы для первичного изучения

- `shared/schema.ts`: estimates, estimateSections, estimatePositions, positionResources
- `server/storage.ts`
- `server/routes/estimates.ts`
- `server/routes/schedule.ts`
- `shared/workPositionKind.ts`

Список не является исчерпывающим. Найди фактические зависимости через импорты, схемы и тесты.

### Обязательные первые действия

1. Прочитай все применимые `AGENTS.md`, `.cursor/rules`, ADR и документацию.
2. Изучи текущий код и существующие тесты; не предполагай отсутствующие контракты.
3. Дай краткий план из 3–7 пунктов.
4. Зафиксируй найденные риски и несовместимости до редактирования.
5. Не начинай широкий рефакторинг без необходимости для acceptance criteria.

### Scope

1. Создай `estimateAnalysisService`.
2. Выдели main work positions по существующим правилам.
3. Нормализуй resource types.
4. Рассчитай summary:
   - sections count;
   - main works count;
   - resource count;
   - labor hours total/coverage;
   - material/equipment candidates;
   - rows without quantity/unit.
5. Определи `laborHoursAvailable` и coverage percent.
6. Сохраняй analysis snapshot с input hash или рассчитывай детерминированно с cache.
7. MCP tool `analyze_estimate`.
8. MCP resource/read tool `get_estimate_analysis`.
9. Возвращай warnings, но не исправляй исходные данные молча.

### Non-goals

- Не использовать LLM для основной классификации.
- Не рассчитывать график.
- Не создавать материалы.
- Не менять импортированные значения.

### Обязательные контракты

- Analysis version/schema version.
- Каждое агрегированное значение трассируется к source IDs.
- Labor hours считаются только из явно поддержанных resource types/units.
- Неизвестные типы попадают в `unclassifiedResources`.
- Error: `WORKFLOW_ESTIMATE_NOT_SET`, `ESTIMATE_NOT_FOUND`.

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

- Повторный анализ одинаковых данных даёт одинаковый JSON.
- Coverage рассчитан корректно на fixture.
- Неизвестные ресурсы не теряются.
- Чужая смета недоступна.
- Snapshot инвалидируется после повторного импорта/изменения source.

### Проверки

- Fixtures для сметы с трудозатратами и без них.
- Aggregation unit tests.
- Snapshot invalidation test.
- MCP contract test.

Обязательно выполнить:

```bash
npm run check
npm test
npm run build
```

### Риски и особые замечания

Нет дополнительных замечаний. Все обнаруженные риски отрази в финальном отчёте.

### Формат финального отчёта

1. Краткий результат.
2. Изменённые файлы.
3. Миграции и совместимость.
4. Добавленные/изменённые контракты.
5. Тесты и фактические результаты команд.
6. Ручной smoke-сценарий.
7. Известные ограничения.
8. Следующая зависимая TASK.
