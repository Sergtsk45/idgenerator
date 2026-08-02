# MCP endpoint — локальное подключение

`POST/GET/DELETE /mcp` — Streamable HTTP, **stateless** (каждый HTTP-запрос обслуживается
новым `McpServer`; сессии/`Mcp-Session-Id` не используются). Реализует TASK-001 из
[`mcp-mvp-plan`](../../mcp-mvp-plan/tasks/TASK-001-mcp-foundation.md).

## Требования

- Endpoint **выключен по умолчанию**. Включить: `MCP_ENABLED=true` в `.env` (opt-in,
  особенно важно для production — включать осознанно, а не по умолчанию).
- `Authorization: Bearer <jwt>` обязателен для **всех tool-вызовов** (не для `initialize`).
  JWT — тот же, что выдаёт `POST /api/auth/login` / `/api/auth/register`.
- Лимит тела запроса — 256 KB, обеспечивается собственным JSON-парсером `/mcp`
  (не связан с 10 MB лимитом REST): превышение → `413 PAYLOAD_TOO_LARGE`.

## Доступные tools (read-only, TASK-001)

| Tool | Описание |
|---|---|
| `ping` | Health-check, возвращает `{ pong: true, userId }` |
| `get_current_user` | Профиль текущего пользователя (`id`, `displayName`, `email`, `role`) |
| `list_objects` | Объекты, принадлежащие текущему пользователю |

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

`AUTH_REQUIRED`, `AUTH_INVALID`, `FORBIDDEN`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.

## Известные ограничения (TASK-001)

- Только read-only diagnostic tools; workflow-инструменты — следующие TASK.
- Host/Origin validation для `/mcp`, audit log и per-tool метрики — TASK-012.
