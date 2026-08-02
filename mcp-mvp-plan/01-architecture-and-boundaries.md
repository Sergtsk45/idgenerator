# Архитектура первого MCP-MVP

## 1. Базовый принцип

Существующий REST-сервис и UI остаются основным ядром продукта. MCP добавляется как адаптер, а не как отдельная реализация бизнес-логики.

```text
AI Client / Agent
       │
       │ MCP Streamable HTTP
       ▼
server/mcp/*
       │
       ├── workflow services
       ├── existing storage
       ├── existing domain services
       └── existing PDF generators
```

## 2. Границы ответственности

### AI-агент

- понимает естественный язык;
- выбирает MCP-инструмент;
- задаёт пользователю вопросы;
- объясняет результат;
- запрашивает подтверждение.

### MCP transport

- protocol handshake;
- tool/resource/prompt discovery;
- authentication context;
- tool invocation;
- progress, cancellation and structured errors.

### Application services

- workflow state machine;
- estimate analysis;
- schedule calculation;
- material classification;
- readiness checks;
- act/worklog/package orchestration.

### Existing domain/storage

- users and objects;
- estimates;
- schedules and tasks;
- materials and documents;
- acts and attachments;
- messages and worklog;
- PDF generation.

## 3. Рекомендуемая структура

```text
server/
├── mcp/
│   ├── createMcpServer.ts
│   ├── httpTransport.ts
│   ├── authContext.ts
│   ├── toolResult.ts
│   ├── errors.ts
│   ├── tools/
│   │   ├── workflow.ts
│   │   ├── uploads.ts
│   │   ├── estimates.ts
│   │   ├── schedule.ts
│   │   ├── materials.ts
│   │   ├── documents.ts
│   │   ├── acts.ts
│   │   └── worklog.ts
│   ├── resources/
│   │   ├── workflowStatus.ts
│   │   ├── scheduleDraft.ts
│   │   └── readinessReport.ts
│   └── prompts/
│       └── executionDocumentation.ts
│
├── services/
│   ├── execution-workflow/
│   │   ├── workflowService.ts
│   │   ├── workflowStateMachine.ts
│   │   ├── workflowInputs.ts
│   │   └── workflowReadiness.ts
│   ├── estimate-analysis/
│   ├── schedule-planning/
│   ├── material-requirements/
│   └── execution-package/
```

## 4. Новые таблицы

### `execution_workflows`

- `id` UUID;
- `user_id`;
- `object_id`;
- `estimate_id`;
- `schedule_id`;
- `stage`;
- `status`;
- `version`;
- `created_at`;
- `updated_at`.

### `execution_workflow_inputs`

- `workflow_id`;
- `key`;
- `value_json`;
- `source`;
- `confirmed`;
- `updated_at`.

### `execution_workflow_events`

Append-only журнал:

- `workflow_id`;
- `event_type`;
- `actor_type`;
- `actor_id`;
- `payload_json`;
- `created_at`.

### `schedule_drafts`

- `workflow_id`;
- `version`;
- `input_hash`;
- `assumptions_json`;
- `tasks_json`;
- `warnings_json`;
- `approved_at`.

### `document_requirement_rules`

Для MVP допускается seed-конфигурация:

- `category`;
- `name_pattern`;
- `required_doc_types`;
- `priority`;
- `active`.

### `upload_sessions`

- `id`;
- `user_id`;
- `object_id`;
- `purpose`;
- `status`;
- `storage_key`;
- `original_filename`;
- `mime_type`;
- `size_bytes`;
- `sha256`;
- `expires_at`.

## 5. Повторное использование существующего кода

| Область | Текущие файлы |
|---|---|
| Server bootstrap | `server/index.ts`, `server/routes.ts` |
| Auth | `server/middleware/auth.ts`, `server/auth-service.ts` |
| Storage | `server/storage.ts` |
| DTO/Zod | `shared/routes.ts` |
| DB schema | `shared/schema.ts` |
| Estimate | `server/routes/estimates.ts` |
| Schedule | `server/routes/schedule.ts` |
| Materials/docs | `server/routes/materials.ts` |
| Acts/PDF | `server/routes/acts.ts`, `server/pdfGenerator.ts` |
| Worklog | `server/routes/messages.ts` |

Обработчики Express не должны вызываться из MCP. Общая логика выносится в сервисные функции, которые вызываются и REST-маршрутом, и MCP-tool.

## 6. MCP-инструменты MVP

### Read-only

- `get_execution_workflow`
- `get_missing_workflow_inputs`
- `get_estimate_analysis`
- `get_schedule_draft`
- `get_material_register`
- `get_missing_quality_documents`
- `check_acts_readiness`
- `get_worklog_draft`
- `check_handover_readiness`

### Write

- `create_execution_workflow`
- `set_workflow_input`
- `create_upload_session`
- `import_estimate_from_upload`
- `calculate_schedule_draft`
- `approve_schedule`
- `build_material_register`
- `attach_document_from_upload`
- `generate_acts`
- `build_execution_package`

## 7. Идемпотентность

Каждый изменяющий tool принимает:

```json
{
  "workflowId": "...",
  "idempotencyKey": "client-generated-key"
}
```

Повторный вызов с тем же ключом:

- не создаёт дубль;
- возвращает ранее сохранённый результат;
- логируется как retry.

Для расчётов хранится `input_hash`. При неизменных входах возвращается существующий draft.

## 8. Авторизация

- MCP endpoint использует `Authorization: Bearer`.
- Токен валидируется существующим auth service.
- Любая сущность проверяется по цепочке:
  `user → object → workflow → entity`.
- Нельзя принимать `userId` из аргументов tool.
- MCP context получает user ID только из проверенного токена.
- Все tool-вызовы пишутся в audit log.
- Удаление и финальный выпуск требуют отдельного подтверждения.

## 9. Передача файлов

MVP использует двухэтапную модель:

1. `create_upload_session`;
2. загрузка файла на защищённый HTTP endpoint;
3. MCP-tool получает `uploadId`.

Запрещено:

- передавать большой файл base64 в tool arguments;
- принимать произвольный локальный путь;
- загружать файл по произвольному внешнему URL;
- доверять MIME без проверки сигнатуры.

## 10. Правила безопасности tool-ов

Каждый tool имеет:

- точное название;
- однозначное описание;
- Zod input schema;
- максимальный размер входа;
- timeout;
- rate limit;
- read/write classification;
- `destructiveHint`;
- audit event;
- ownership checks;
- безопасную обработку ошибок.

## 11. Разделение deterministic и AI logic

Детерминированно:

- права;
- workflow transitions;
- формулы;
- даты;
- проверки комплектности;
- сохранение;
- генерация файлов.

AI/эвристика:

- классификация неоднозначных ресурсов;
- нормализация названий;
- объяснение результата.

Любой AI-результат хранится с:

- моделью;
- версией prompt;
- confidence;
- исходными данными;
- статусом подтверждения.

## 12. Версионирование

- Workflow имеет optimistic `version`.
- Изменяющий tool принимает `expectedVersion`.
- При конфликте возвращается `WORKFLOW_VERSION_CONFLICT`.
- Утверждённый график не изменяется молча; создаётся новая версия.
