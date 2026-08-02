# TASK-009: Readiness актов и MCP-оркестрация генерации

## Метаданные

- **Тип:** implementation task
- **Зависимости:** TASK-006, TASK-008
- **Результат:** Добавить формальную проверку готовности актов и безопасно открыть существующую генерацию актов/PDF через MCP.

## Задание агенту

### Роль

Ты — senior TypeScript backend engineer, работающий в существующем репозитории `Sergtsk45/idgenerator`. Твоя задача — выполнить только описанный scope, сохранив совместимость существующего приложения.

### Цель

Добавить формальную проверку готовности актов и безопасно открыть существующую генерацию актов/PDF через MCP.

### Контекст

Генерация уже существует, но агенту нужен структурированный список блокирующих данных до выпуска.

### Связанные файлы для первичного изучения

- `server/routes/schedule.ts`: generate acts
- `server/routes/acts.ts`
- `server/pdfGenerator.ts`
- `server/actAttachmentsPdf.ts`
- act templates
- source data
- materials/documents bindings

Список не является исчерпывающим. Найди фактические зависимости через импорты, схемы и тесты.

### Обязательные первые действия

1. Прочитай все применимые `AGENTS.md`, `.cursor/rules`, ADR и документацию.
2. Изучи текущий код и существующие тесты; не предполагай отсутствующие контракты.
3. Дай краткий план из 3–7 пунктов.
4. Зафиксируй найденные риски и несовместимости до редактирования.
5. Не начинай широкий рефакторинг без необходимости для acceptance criteria.

### Scope

1. Вынеси generate-acts orchestration в service.
2. Создай readiness service per act/task group.
3. Проверяй обязательные поля MVP.
4. MCP `check_acts_readiness`.
5. MCP `generate_acts` с confirmation token/flag.
6. MCP `export_act_pdf`.
7. MCP `export_act_attachments`.
8. Возвращай generated artifact metadata.
9. Write actions идемпотентны.
10. Не затирай manual attachments.
11. Добавь draft/final distinction.

### Non-goals

- Не менять юридический шаблон без отдельного задания.
- Не автоматически подставлять отсутствующих представителей.
- Не выпускать final при blocking issues.
- Не удалять акты вне текущего workflow без проверки.

### Обязательные контракты

- Blocking issue содержит code, entity ID, user-facing question/reason.
- Draft generation допускается только с явным режимом и статусом draft.
- Final requires no blockers and explicit user confirmation.
- Artifact URL scoped to user/object.
- Existing REST actions use shared service.
- Error codes: `ACTS_NOT_READY`, `ACT_GENERATION_REQUIRES_CONFIRMATION`, `ARTIFACT_NOT_OWNED`.

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

- Readiness fixture identifies expected blockers.
- Final blocked when passport missing.
- Manual attachments preserved.
- Retry generation does not duplicate attachments/files unexpectedly.
- PDF export works for ready fixture.
- Cross-user artifact forbidden.

### Проверки

- Readiness unit tests.
- Integration generate/export.
- Existing act tests.
- Authorization tests.
- Manual attachment regression.

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
