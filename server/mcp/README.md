# MCP endpoint — локальное подключение

`POST/GET/DELETE /mcp` — Streamable HTTP, **stateless** (каждый HTTP-запрос обслуживается
новым `McpServer`; сессии/`Mcp-Session-Id` не используются). Реализует TASK-001–TASK-005 из
[`mcp-mvp-plan`](../../mcp-mvp-plan/).

## Требования

- Endpoint **выключен по умолчанию**. Включить: `MCP_ENABLED=true` в `.env` (opt-in,
  особенно важно для production — включать осознанно, а не по умолчанию).
- `Authorization: Bearer <jwt>` обязателен для **всех tool-вызовов** (не для `initialize`).
  JWT — тот же, что выдаёт `POST /api/auth/login` / `/api/auth/register`.
- Лимит тела запроса — 256 KB, обеспечивается собственным JSON-парсером `/mcp`
  (не связан с 10 MB лимитом REST): превышение → `413 PAYLOAD_TOO_LARGE`.
- Перед использованием workflow/upload/analysis tools применить миграции `0029`–`0032`.
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
| `create_upload_session` | Создаёт одноразовую 30-минутную XLSX-сессию и возвращает authenticated upload URL |
| `import_estimate_from_upload` | Импортирует XLSX, привязывает estimate к workflow и consumed upload (idempotent) |

Upload выполняется как `multipart/form-data`, поле `file`, на возвращённый URL с тем же
`Authorization: Bearer <jwt>`. Допускается только `.xlsx` с MIME
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, лимит — 20 MB.

### Estimate analysis (TASK-004)

| Tool | Описание |
|---|---|
| `analyze_estimate` | Детерминированно анализирует source rows, сохраняет snapshot и переводит stage в `estimate_analysis_ready` |
| `get_estimate_analysis` | Возвращает только актуальный snapshot; stale source требует повторного `analyze_estimate` |

Coverage — процент основных работ с положительной поддержанной трудоёмкостью. Трудовые
часы принимаются только для `ОТ`/`ОТМ` в человеко-часах либо untyped строки с единицей
человеко-часов; неизвестные типы возвращаются в `unclassifiedResources`.

Все tools ownership-scoped по `userId` из проверенного JWT — не из аргументов вызова.

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

`AUTH_REQUIRED`, `AUTH_INVALID`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`,
`INTERNAL_ERROR`, `WORKFLOW_VERSION_CONFLICT`, `WORKFLOW_TRANSITION_NOT_ALLOWED`.

TASK-003 также возвращает `UPLOAD_EXPIRED`, `UPLOAD_NOT_FOUND`,
`UPLOAD_ALREADY_CONSUMED`, `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`,
`ESTIMATE_IMPORT_FAILED`.

TASK-004 добавляет `WORKFLOW_ESTIMATE_NOT_SET`, `ESTIMATE_NOT_FOUND`.

Для конфликтов версий может присутствовать `recoverable: true`.

## Известные ограничения

- Schedule draft stale определяется сравнением `scheduleInputHash`; enforcement добавляется в TASK-006.
- `create_upload_session` и `import_estimate_from_upload` выполняют свои stage transitions серверно.
- Автоматическая уборка истёкших/осиротевших upload-файлов пока не реализована.
- Порог labor coverage для режима планирования по численности задаётся в TASK-006.
- Host/Origin validation для `/mcp`, audit log и per-tool метрики — TASK-012.
