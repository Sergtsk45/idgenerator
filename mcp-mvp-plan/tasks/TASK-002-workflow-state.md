# TASK-002: Состояние execution workflow, inputs, events и idempotency

## Метаданные

- **Тип:** implementation task
- **Зависимости:** TASK-001
- **Результат:** Создать персистентную state machine, которая хранит прогресс многошагового сценария независимо от истории чата.

## Задание агенту

### Роль

Ты — senior TypeScript backend engineer, работающий в существующем репозитории `Sergtsk45/idgenerator`. Твоя задача — выполнить только описанный scope, сохранив совместимость существующего приложения.

### Цель

Создать персистентную state machine, которая хранит прогресс многошагового сценария независимо от истории чата.

### Контекст

Агент может быть перезапущен или сменён. Источник истины должен находиться в PostgreSQL.

### Связанные файлы для первичного изучения

- `shared/schema.ts`
- `server/storage.ts`
- `server/db.ts`
- `migrations/`
- `server/mcp/tools/`
- текущие паттерны миграций и storage interfaces

Список не является исчерпывающим. Найди фактические зависимости через импорты, схемы и тесты.

### Обязательные первые действия

1. Прочитай все применимые `AGENTS.md`, `.cursor/rules`, ADR и документацию.
2. Изучи текущий код и существующие тесты; не предполагай отсутствующие контракты.
3. Дай краткий план из 3–7 пунктов.
4. Зафиксируй найденные риски и несовместимости до редактирования.
5. Не начинай широкий рефакторинг без необходимости для acceptance criteria.

### Scope

1. Добавь таблицы `execution_workflows`, `execution_workflow_inputs`, `execution_workflow_events`, `tool_idempotency_records`.
2. Реализуй state machine с разрешёнными переходами.
3. Создай workflow service и storage methods.
4. Добавь MCP tools:
   - `create_execution_workflow`;
   - `get_execution_workflow`;
   - `set_workflow_input`;
   - `get_missing_workflow_inputs` как временный базовый контракт.
5. Реализуй optimistic version.
6. Реализуй idempotency для write tools.
7. Записывай append-only events.
8. Не хранить chat transcript.

### Non-goals

- Не реализовывать анализ сметы.
- Не создавать график.
- Не хранить файлы.
- Не строить UI workflow.

### Обязательные контракты

- Workflow принадлежит `userId` и `objectId`.
- `version` увеличивается при изменениях.
- Write tool принимает `expectedVersion` и `idempotencyKey`.
- Конфликт: `WORKFLOW_VERSION_CONFLICT`.
- Повтор idempotency key возвращает исходный результат.
- Недопустимый переход: `WORKFLOW_TRANSITION_NOT_ALLOWED`.
- Input содержит `source` и `confirmed`.

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

- Workflow сохраняется после рестарта процесса.
- Чужой workflow возвращает 404/forbidden без утечки существования.
- Повторный create с одним ключом не создаёт дубль.
- Concurrent update детектируется.
- Event log отражает create/input/stage transition.

### Проверки

- Migration tests.
- State transition unit tests.
- Idempotency integration tests.
- Ownership tests.
- Concurrency/version test.

Обязательно выполнить:

```bash
npm run check
npm test
npm run build
```

### Риски и особые замечания

Не хранить произвольный LLM-текст как состояние. Значимые данные должны быть структурированы.

### Формат финального отчёта

1. Краткий результат.
2. Изменённые файлы.
3. Миграции и совместимость.
4. Добавленные/изменённые контракты.
5. Тесты и фактические результаты команд.
6. Ручной smoke-сценарий.
7. Известные ограничения.
8. Следующая зависимая TASK.
