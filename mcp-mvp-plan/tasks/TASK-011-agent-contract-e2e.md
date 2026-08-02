# TASK-011: MCP prompts/resources, контракт агента и сквозной E2E

## Метаданные

- **Тип:** implementation task
- **Зависимости:** TASK-001–TASK-010
- **Результат:** Описать и проверить поведение целевого AI-агента на полном сценарии от загрузки сметы до пакета.

## Задание агенту

### Роль

Ты — senior TypeScript backend engineer, работающий в существующем репозитории `Sergtsk45/idgenerator`. Твоя задача — выполнить только описанный scope, сохранив совместимость существующего приложения.

### Цель

Описать и проверить поведение целевого AI-агента на полном сценарии от загрузки сметы до пакета.

### Контекст

Наличие tools недостаточно: модели нужен стабильный контракт, resources статуса и правила подтверждений.

### Связанные файлы для первичного изучения

- все `server/mcp/`
- workflow envelope
- scenario docs
- test fixtures
- target MCP client configuration

Список не является исчерпывающим. Найди фактические зависимости через импорты, схемы и тесты.

### Обязательные первые действия

1. Прочитай все применимые `AGENTS.md`, `.cursor/rules`, ADR и документацию.
2. Изучи текущий код и существующие тесты; не предполагай отсутствующие контракты.
3. Дай краткий план из 3–7 пунктов.
4. Зафиксируй найденные риски и несовместимости до редактирования.
5. Не начинай широкий рефакторинг без необходимости для acceptance criteria.

### Scope

1. Добавь MCP resources:
   - workflow status;
   - schedule draft;
   - material readiness;
   - acts readiness.
2. Добавь MCP prompt/template `execution_documentation_workflow`.
3. В prompt зафиксируй:
   - задавать вопросы только по missingInputs;
   - показывать assumptions;
   - не выдумывать;
   - получать подтверждение на approval/final actions;
   - продолжать с текущего stage.
4. Добавь tool descriptions с точными side effects.
5. Создай E2E harness или интеграционный сценарий без зависимости от LLM.
6. Прогони happy path fixture.
7. Прогони recovery paths:
   - нет labor hours;
   - missing passport;
   - expired upload;
   - stale draft.
8. Создай manual test script для реального MCP-клиента.

### Non-goals

- Не встраивать конкретную модель в MCP server.
- Не хранить system prompt в БД без версии.
- Не делать авто-вызов destructive/final tools.
- Не считать E2E успешным только по mock одного tool.

### Обязательные контракты

- Prompt versioned.
- Tool descriptions не обещают действий, которых нет.
- Resource URI стабильны.
- E2E проверяет stage transitions.
- При переподключении агент продолжает workflow.
- Confirmation gates нельзя обойти tool arguments.
- Test output содержит artifact IDs и readiness.

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

- Happy path проходит все этапы workflow.
- Recovery paths возвращают ожидаемые error/blocking codes.
- Повторное подключение продолжает тот же workflow.
- Approval/final tools требуют серверно проверяемое подтверждение.
- MCP discovery содержит ожидаемые tools/resources/prompts.
- Manual test script воспроизводим.

### Проверки

- Deterministic E2E test all stages.
- Recovery scenario tests.
- MCP discovery snapshot test.
- Manual smoke checklist for ChatGPT/Claude/Cursor or selected client.

Обязательно выполнить:

```bash
npm run check
npm test
npm run build
```

### Риски и особые замечания

Не полагаться на скрытое поведение модели. Все critical transitions должны контролироваться сервером.

### Формат финального отчёта

1. Краткий результат.
2. Изменённые файлы.
3. Миграции и совместимость.
4. Добавленные/изменённые контракты.
5. Тесты и фактические результаты команд.
6. Ручной smoke-сценарий.
7. Известные ограничения.
8. Следующая зависимая TASK.
