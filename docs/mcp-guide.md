# MCP-IDgenerator: подключение локального MCP-клиента

## Что это

`POST /mcp` — защищённый MCP endpoint (Streamable HTTP, JSON-RPC 2.0), встроенный в
существующее Express-приложение как отдельный transport layer. Он **не заменяет** REST
API (`/api/*`) и не дублирует бизнес-логику: tools вызывают те же storage/service-функции,
что и REST-маршруты.

Реализация: `server/mcp/` (см. `mcp-mvp-plan/01-architecture-and-boundaries.md`).

## Аутентификация

Единственный поддерживаемый способ — `Authorization: Bearer <jwt>`, тот же JWT, что и для
REST API (`POST /api/auth/login` / `/api/auth/register`). Запрос без токена или с
невалидным/просроченным токеном получает `401` до какого-либо MCP-рукопожатия.

`userId` для tools всегда берётся из проверенного токена сервером — tool arguments с
`userId`/`objectId owner` не участвуют в определении личности вызывающего.

## Локальный запуск

```bash
npm run dev
# сервер поднимается на http://localhost:5000 (или $PORT)
```

Получить JWT:

```bash
curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}'
```

## Пример вызова через curl

```bash
TOKEN="<jwt из /api/auth/login>"

# 1) initialize handshake
curl -s -X POST http://localhost:5000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"local-client","version":"1.0"}}}'

# 2) список доступных tools
curl -s -X POST http://localhost:5000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3) вызов tool
curl -s -X POST http://localhost:5000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ping","arguments":{}}}'
```

## Доступные tools (TASK-001 + TASK-002)

### Diagnostic (read-only)
- `ping` — health-check, возвращает `userId` и серверное время.
- `get_current_user` — профиль текущего пользователя (без секретов).
- `list_objects` — объекты строительства текущего пользователя.

### Execution workflow
- `create_execution_workflow(objectId, idempotencyKey)` — создаёт workflow для объекта пользователя.
- `get_execution_workflow(workflowId)` — текущее состояние: стадия, версия, inputs, missing inputs.
- `set_workflow_input(workflowId, expectedVersion, idempotencyKey, key, value, source, confirmed)` — сохраняет значение входного параметра с optimistic-concurrency и idempotency.
- `get_missing_workflow_inputs(workflowId)` — временный базовый контракт: список ещё не подтверждённых вопросов планирования графика (будет заменён в TASK-005 реальным движком, привязанным к анализу сметы).

Write-tools (`create_execution_workflow`, `set_workflow_input`) обязательны с
`idempotencyKey`: повторный вызов с тем же ключом и теми же аргументами возвращает исходный
результат вместо повторного выполнения; тот же ключ с другими аргументами — ошибка
`VALIDATION_ERROR`.

## Коды ошибок

| Код | Значение |
|---|---|
| `AUTH_REQUIRED` | Bearer JWT отсутствует |
| `AUTH_INVALID` | JWT невалиден/просрочен |
| `FORBIDDEN` | доступ запрещён |
| `NOT_FOUND` | сущность не найдена или принадлежит другому пользователю (специально не различаются, чтобы не раскрывать существование чужих данных) |
| `VALIDATION_ERROR` | некорректные аргументы tool или конфликт idempotency-ключа |
| `WORKFLOW_VERSION_CONFLICT` | `expectedVersion` не совпадает с текущей версией workflow (concurrent update) |
| `WORKFLOW_TRANSITION_NOT_ALLOWED` | запрошенный переход стадии не разрешён state machine |
| `INTERNAL_ERROR` | непредвиденная ошибка сервера (без stack trace в ответе) |

## Ограничения MVP

- `/mcp` работает в **stateless**-режиме: на каждый HTTP-запрос создаётся новый
  `McpServer`/transport. Resumable SSE-стримы и server-initiated notifications между
  запросами не поддерживаются — для diagnostic/orchestration tools MVP это не требуется.
- Rate limit: 60 запросов в минуту на пользователя (или IP, если пользователь ещё не
  определён), тело запроса ограничено 1 MB — большие файлы передаются через отдельный
  механизм upload session (появится в TASK-003).
