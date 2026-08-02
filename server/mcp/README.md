# MCP endpoint — локальное подключение

`POST/GET/DELETE /mcp` — Streamable HTTP, **stateless** (каждый HTTP-запрос обслуживается
новым `McpServer`; сессии/`Mcp-Session-Id` не используются). Реализует TASK-001–TASK-012 из
[`mcp-mvp-plan`](../../mcp-mvp-plan/).

## Требования

- Endpoint **выключен по умолчанию**. Включить: `MCP_ENABLED=true` в `.env` (opt-in,
  особенно важно для production — включать осознанно, а не по умолчанию).
- `Authorization: Bearer <jwt>` обязателен для **всех tool-вызовов** (не для `initialize`).
  JWT — тот же, что выдаёт `POST /api/auth/login` / `/api/auth/register`.
- Лимит тела запроса — 256 KB, обеспечивается собственным JSON-парсером `/mcp`
  (не связан с 10 MB лимитом REST): превышение → `413 PAYLOAD_TOO_LARGE`.
- Перед использованием workflow/upload/analysis/schedule/material tools применить миграции `0029`–`0034`.
- Для persistent хранения XLSX задайте `ESTIMATE_UPLOAD_DIR` (по умолчанию `uploads/estimates`).

## Доступные tools

### Diagnostic (TASK-001, read-only)

| Tool | Описание |
|---|---|
| `ping` | Health-check, возвращает `{ pong: true, userId }` |
| `get_current_user` | Профиль текущего пользователя (`id`, `displayName`, `email`, `role`) |
| `list_objects` | Объекты, принадлежащие текущему пользователю |

### Execution workflow (TASK-002)

| Tool | Описание |
|---|---|
| `create_execution_workflow` | Создаёт workflow для объекта пользователя (idempotent) |
| `get_execution_workflow` | Текущий stage/version/inputs/missing inputs |
| `get_missing_workflow_inputs` | Формальные conditional вопросы и blocking issues для графика |
| `set_workflow_input` | Валидирует и сохраняет catalog input с `expectedVersion` + `idempotencyKey` |

`get_missing_workflow_inputs` возвращает формальные вопросы, `blockingIssues`, readiness и
`scheduleInputHash`. Для crew mode требуются актуальные labor data; defaults 8 часов и 0.85
не считаются заполненными без явного подтверждения.

### Estimate upload (TASK-003)

| Tool | Описание |
|---|---|
| `create_upload_session` | Создаёт одноразовую 30-минутную XLSX/PDF-сессию по `purpose` и возвращает authenticated upload URL |
| `import_estimate_from_upload` | Импортирует XLSX, привязывает estimate к workflow и consumed upload (idempotent) |

Upload выполняется как `multipart/form-data`, поле `file`, на возвращённый URL с тем же
`Authorization: Bearer <jwt>`. Purpose по умолчанию — `estimate`: `.xlsx`, MIME
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, лимит 20 MB.
Purpose `quality_document` принимает только `.pdf`, MIME `application/pdf`, лимит 50 MB.

### Estimate analysis (TASK-004)

| Tool | Описание |
|---|---|
| `analyze_estimate` | Детерминированно анализирует source rows, сохраняет snapshot и переводит stage в `estimate_analysis_ready` |
| `get_estimate_analysis` | Возвращает только актуальный snapshot; stale source требует повторного `analyze_estimate` |

Coverage — процент основных работ с положительной поддержанной трудоёмкостью. Трудовые
часы принимаются только для `ОТ`/`ОТМ` в человеко-часах либо untyped строки с единицей
человеко-часов; неизвестные типы возвращаются в `unclassifiedResources`.

### Schedule planning (TASK-006)

| Tool | Описание |
|---|---|
| `calculate_schedule_draft` | Рассчитывает и сохраняет versioned draft по актуальным confirmed inputs |
| `get_schedule_draft` | Возвращает последний draft без изменения workflow |
| `approve_schedule` | Проверяет freshness и атомарно создаёт schedule с position-linked tasks |

Target-duration распределяется по формальным весам с минимумом один рабочий день.
Crew-size доступен только при 100% labor coverage. Календарь пропускает выходные;
изменение effective input или сметы делает ранее рассчитанный draft stale.

### Material register (TASK-007)

| Tool | Описание |
|---|---|
| `build_material_register` | Строит/rebuild реестр из ресурсов актуальной сметы и связывает items с schedule tasks |
| `get_material_register` | Возвращает classifications, source links, requirements и blockers |
| `confirm_material_classification` | Сохраняет manual override одного register item |
| `get_missing_quality_documents` | Возвращает неудовлетворённые seed requirements и unclassified blockers |

Dedup выполняется только по полному normalized name+unit+category без fuzzy matching.
Seed requirements — проверяемая MVP-эвристика, а не утверждение нормативной достаточности.
Для TASK-007 нужен линейный approved schedule с одной task на main position; split schedule
возвращается как stale, пока source-link не поддерживает связь с несколькими tasks.

### Document ingestion (TASK-008)

| Tool | Описание |
|---|---|
| `attach_document_from_upload` | Создаёт project document из consumed PDF, привязывает к owned material и возвращает актуальные missing requirements |
| `list_material_documents` | Возвращает активные документы одного material register item без изменения workflow |

Допустимые типы: `certificate`, `declaration`, `passport`, `protocol`. Binding role
выводится сервером; один upload нельзя привязать к другому материалу, а retry с тем же
idempotency key не создаёт повторный document/binding.

### Acts readiness и artifacts (TASK-009)

| Tool | Описание |
|---|---|
| `check_acts_readiness` | Возвращает readiness и blockers по каждой группе act number |
| `generate_acts` | Создаёт draft/final акты; final требует `confirmFinal: true` и ноль blockers |
| `export_act_pdf` | Создаёт owner-scoped PDF artifact акта |
| `export_act_attachments` | Создаёт owner-scoped PDF-пакет приложений |

Draft не переводит workflow в generated state. Повторная генерация сохраняет manual
attachments и не изменяет signed acts. Artifact URL требует authenticated REST request.

### Worklog draft и execution package (TASK-010)

| Tool | Описание |
|---|---|
| `get_worklog_draft` | Возвращает последний draft и признак freshness |
| `generate_worklog_draft` | Идемпотентно сохраняет traceable journal draft |
| `check_handover_readiness` | Возвращает expected/missing artifacts, blockers, warnings и assumptions |
| `build_execution_package` | Собирает size-limited draft/final ZIP; final требует `confirmFinal: true` |

Worklog различает `planned`, `reported`, `act_confirmed`; название и payload явно не
заявляют полную нормативную форму ОЖР. Package download требует auth. ZIP хранится в
`EXECUTION_PACKAGES_DIR` (по умолчанию `generated_pdfs/packages`), лимит unpacked input 100 MB.

Все tools ownership-scoped по `userId` из проверенного JWT — не из аргументов вызова.

### Agent contract, workflow resources и prompts (TASK-011)

| Resource / Prompt | Описание |
|---|---|
| `idgenerator://workflow/{workflowId}/status` | Текущий workflow snapshot с inputs, missing inputs, readiness и hash |
| `idgenerator://workflow/{workflowId}/schedule-draft` | Последний schedule draft и `fresh`-признак |
| `idgenerator://workflow/{workflowId}/material-readiness` | Material register, missing quality documents и blockers |
| `idgenerator://workflow/{workflowId}/acts-readiness` | Acts readiness и structured blockers |
| `execution_documentation_workflow` | Версионированный prompt v1: only missingInputs, explicit assumptions, no invention, confirmation before approval/final actions, continue current stage |

`resources/list` и `prompts/list` возвращают только owned workflows текущего пользователя.
`prompts/get` ожидает `workflowId` и возвращает system+user messages без запуска модели.

## Быстрая проверка через curl

```bash
# 1) Получить JWT
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"12345678"}' | jq -r .token)

# 2) initialize (не требует auth)
curl -s -X POST http://localhost:5000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"local","version":"0"}}}'

# 3) tools/call (требует Bearer JWT)
curl -s -X POST http://localhost:5000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_objects","arguments":{}}}'

# 4) list resources / prompts
curl -s -X POST http://localhost:5000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/list","params":{}}'

curl -s -X POST http://localhost:5000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":4,"method":"prompts/list","params":{}}'

curl -s -X POST http://localhost:5000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":5,"method":"prompts/get","params":{"name":"execution_documentation_workflow","arguments":{"workflowId":123}}}'
```

## Подключение MCP-клиента (например, Cursor/Claude Desktop)

Большинство MCP-клиентов с поддержкой Streamable HTTP настраиваются так:

```json
{
  "mcpServers": {
    "idgenerator": {
      "url": "http://localhost:5000/mcp",
      "headers": {
        "Authorization": "Bearer <jwt>"
      }
    }
  }
}
```

## Коды ошибок

Стабильные machine-readable коды в `content[0].text` при `isError: true`:

`AUTH_REQUIRED`, `AUTH_INVALID`, `FORBIDDEN`, `RATE_LIMITED`, `NOT_FOUND`, `VALIDATION_ERROR`,
`INTERNAL_ERROR`, `WORKFLOW_VERSION_CONFLICT`, `WORKFLOW_TRANSITION_NOT_ALLOWED`.

TASK-003 также возвращает `UPLOAD_EXPIRED`, `UPLOAD_NOT_FOUND`,
`UPLOAD_ALREADY_CONSUMED`, `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`,
`ESTIMATE_IMPORT_FAILED`.

TASK-004 добавляет `WORKFLOW_ESTIMATE_NOT_SET`, `ESTIMATE_NOT_FOUND`.

TASK-006 добавляет `SCHEDULE_INPUTS_INCOMPLETE`, `LABOR_DATA_REQUIRED`,
`SCHEDULE_DRAFT_STALE`, `SCHEDULE_APPROVAL_CONFLICT`.

TASK-007 добавляет `MATERIAL_REGISTER_NOT_READY`, `MATERIAL_REGISTER_NOT_FOUND`,
`MATERIAL_REGISTER_STALE`.

TASK-008 добавляет `DOCUMENT_UPLOAD_INVALID`, `MATERIAL_NOT_OWNED`,
`DOCUMENT_ALREADY_ATTACHED`.

TASK-009 добавляет `ACTS_NOT_READY`, `ACT_GENERATION_REQUIRES_CONFIRMATION`,
`ARTIFACT_NOT_OWNED`.

TASK-010 добавляет `WORKLOG_NOT_READY`, `WORKLOG_DRAFT_NOT_FOUND`,
`WORKLOG_DRAFT_STALE`, `HANDOVER_NOT_READY`, `PACKAGE_REQUIRES_CONFIRMATION`,
`PACKAGE_TOO_LARGE`, `PACKAGE_NOT_OWNED`, `PACKAGE_FILE_UNAVAILABLE`.

Для конфликтов версий может присутствовать `recoverable: true`.

## Известные ограничения

- Planner MVP линейный: одна бригада, без CPM и параллельных работ.
- `create_upload_session` и `import_estimate_from_upload` выполняют свои stage transitions серверно.
- Автоматическая уборка истёкших/осиротевших upload-файлов пока не реализована.
- Host/Origin validation для `/mcp`, audit log, per-tool метрики и runbook для пилота — см. `docs/mcp-pilot-runbook.md`.
