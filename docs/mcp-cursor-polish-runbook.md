# Runbook: полировка MCP-агента в Cursor

**Цель:** довести сквозной сценарий исполнительной документации до стабильной работы во внешнем чате Cursor **до** разработки UI-варианта B (экран «Ассистент»).

**Связанные документы:**
- `server/mcp/README.md` — tools, auth, ошибки
- `docs/mcp-pilot-runbook.md` — preflight / rollback / security smoke
- `docs/task011-mcp-smoke.md` — минимальный discovery smoke
- `mcp-mvp-plan/00-mvp-scenario.md` — продуктовый сценарий

**Критерий готовности к B:** один тестовый объект проходит путь «смета → пакет» в Cursor без ручных REST-костылей, с обязательными confirm на approve/final.

---

## 0. Подготовка окружения

### 0.1 Сервер

```bash
# .env
MCP_ENABLED=true
# для localhost обычно достаточно дефолтов host guard
# MCP_ALLOWED_HOSTNAMES=localhost
# MCP_ALLOWED_ORIGINS=

DATABASE_URL=...
JWT_SECRET=...
# при необходимости:
# ESTIMATE_UPLOAD_DIR=uploads/estimates
# EXECUTION_PACKAGES_DIR=generated_pdfs/packages
```

Запуск приложения (порт по умолчанию `5000`). Миграции workflow/MCP (`0029`–`0034` и новее по changelog) применены.

### 0.2 JWT

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' | jq -r .token)

echo "$TOKEN"
```

Токен живёт по `JWT_EXPIRES_IN`. Протух — обновить в MCP-конфиге Cursor.

### 0.3 Подключение Cursor

`~/.cursor/mcp.json` или `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "idgenerator": {
      "url": "http://localhost:5000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_JWT"
      }
    }
  }
}
```

Проверка:
1. Settings → Tools & MCP → `idgenerator` зелёный.
2. В Agent-чате видны tools (`ping`, `list_objects`, …) и resources/prompts.
3. Быстрый sanity:

```text
Вызови ping и get_current_user. Покажи мой userId и список объектов (list_objects).
Ничего не изменяй.
```

**Gate 0:** auth ок, объекты только свои, чужих нет.

---

## 1. Правила агента (всегда в начале сессии)

Скопируйте в первый message Agent-чата (или после `prompts/get`):

```text
Ты работаешь с MCP-сервером idgenerator.
Правила:
1. Сначала читай resource status текущего workflow, не перезапускай сценарий.
2. Спрашивай пользователя ТОЛЬКО по missingInputs / blockingIssues с сервера.
3. Не выдумывай даты, трудоёмкость, нормативы, ФИО, производительность.
4. Все допущения показывай явно и жди подтверждения.
5. Перед approve_schedule, generate_acts(confirmFinal), build_execution_package(confirmFinal)
   всегда спрашивай явное «да» пользователя.
6. При ошибках *_STALE / *_NOT_READY / WORKFLOW_VERSION_CONFLICT —
   перечитай status и предложи следующий корректный шаг, не ломай workflow.
7. Файлы: create_upload_session → я загружаю multipart на URL → потом import/attach.
```

После появления `workflowId` попросите агента открыть prompt:

```text
Вызови prompt execution_documentation_workflow с workflowId=<ID>
и продолжай строго с текущего stage.
```

---

## 2. Сквозной сценарий полировки

Используйте **один** тестовый объект и **одну** смету XLSX (известный эталон из `testFiles/` или ваш пилотный файл). Заводите чеклист ниже как есть — без перескоков.

### Этап A — старт workflow

**Промпт:**

```text
Покажи мои объекты. Создай (или найди) execution workflow для объекта «<ИМЯ>».
Верни workflowId, stage, version. Не загружай смету пока.
```

| Проверка | Ожидание |
|---|---|
| Tool | `list_objects`, `create_execution_workflow` / `get_execution_workflow` |
| Resource | `idgenerator://workflow/{id}/status` |
| Gate A | Есть `workflowId`, stage понятен, повторный create идемпотентен |

### Этап B — смета

**Промпт:**

```text
Создай upload session для estimate. Дай URL и правила файла.
После моей загрузки импортируй смету в workflow и сделай analyze_estimate.
Покажи coverage и unclassifiedResources. Не переходи к графику без моего OK.
```

Ручной шаг пользователя:

```bash
curl -s -X POST "http://localhost:5000/api/mcp/uploads/<uploadId>" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/estimate.xlsx"
```

| Проверка | Ожидание |
|---|---|
| Tools | `create_upload_session`, `import_estimate_from_upload`, `analyze_estimate`, `get_estimate_analysis` |
| Ошибки | Повторный import с тем же idempotency key не дублирует; просроченный upload → `UPLOAD_EXPIRED` |
| Gate B | Analysis snapshot есть; агент **не** выдумывает трудоёмкость для unclassified |

### Этап C — missing inputs

**Промпт:**

```text
Вызови get_missing_workflow_inputs. Задай мне вопросы ТОЛЬКО из missingInputs.
После каждого ответа сохраняй через set_workflow_input с expectedVersion.
Когда ready=true — остановись и покажи итог inputs.
```

| Проверка | Ожидание |
|---|---|
| Tools | `get_missing_workflow_inputs`, `set_workflow_input` |
| Поведение | Нет «лишних» вопросов от модели; version conflict обрабатывается retry |
| Gate C | `ready=true` или явный список blockers; defaults 8ч/0.85 не считаются заполненными без confirm |

### Этап D — график

**Промпт:**

```text
Рассчитай schedule draft. Покажи краткую сводку по дням/задачам и допущения.
НЕ вызывай approve_schedule, пока я явно не подтвержу.
```

После ревью:

```text
Подтверждаю график. Выполни approve_schedule.
```

| Проверка | Ожидание |
|---|---|
| Tools | `calculate_schedule_draft`, `get_schedule_draft`, `approve_schedule` |
| Resource | `.../schedule-draft` → `fresh=true` до approve |
| Gate D | Без вашего «да» approve не было; после approve tasks созданы; stale draft ловится |

### Этап E — материалы и документы

**Промпт:**

```text
Собери material register. Покажи unclassified и missing quality documents.
Для недостающих PDF: create_upload_session(purpose=quality_document),
я загружу файл, ты сделаешь attach_document_from_upload.
Не выдумывай наличие сертификатов.
```

| Проверка | Ожидание |
|---|---|
| Tools | `build_material_register`, `get_material_register`, `get_missing_quality_documents`, `attach_document_from_upload`, `list_material_documents` |
| Resource | `.../material-readiness` |
| Gate E | Binding только к owned material; retry idempotent; readiness обновляется после attach |

### Этап F — акты

**Промпт:**

```text
Проверь check_acts_readiness. Если есть blockers — перечисли и остановись.
Если ready — предложи draft generate_acts без final.
Final только после моего явного confirmFinal.
```

| Проверка | Ожидание |
|---|---|
| Tools | `check_acts_readiness`, `generate_acts`, `export_act_pdf`, `export_act_attachments` |
| Resource | `.../acts-readiness` |
| Gate F | Final без confirm → `ACT_GENERATION_REQUIRES_CONFIRMATION`; PDF URL требует auth |

### Этап G — журнал и пакет

**Промпт:**

```text
Собери worklog draft и check_handover_readiness.
Покажи missing artifacts / blockers / assumptions.
Собери draft execution package.
Final package — только после моего подтверждения.
```

Опционально заранее добавьте факты в Home-чат (`/`) — они попадут в draft как `reported`.

| Проверка | Ожидание |
|---|---|
| Tools | `get_worklog_draft`, `generate_worklog_draft`, `check_handover_readiness`, `build_execution_package` |
| Gate G | Final без confirm → `PACKAGE_REQUIRES_CONFIRMATION`; ZIP только owner-scoped |

### Этап H — восстановление / продолжение

Новый Agent-чат (имитация «перезапуска»):

```text
Мой workflowId=<ID>. Прочитай status и prompt execution_documentation_workflow.
Продолжи с текущего stage, не создавай новый workflow.
```

| Проверка | Ожидание |
|---|---|
| Gate H | Агент не начинает с нуля; stage/version совпадают с БД |

---

## 3. Негативные проверки (обязательны перед B)

Пройти хотя бы раз:

| # | Действие | Ожидание |
|---|---|---|
| N1 | Убрать/сломать JWT | `AUTH_REQUIRED` / `AUTH_INVALID`, без утечки internals |
| N2 | Чужой `workflowId` / `objectId` | `NOT_FOUND` / `FORBIDDEN`, чужих данных нет |
| N3 | Approve при stale draft | `SCHEDULE_DRAFT_STALE` или conflict; агент предлагает пересчёт |
| N4 | Final acts при blockers | `ACTS_NOT_READY` |
| N5 | Final package без confirm | `PACKAGE_REQUIRES_CONFIRMATION` |
| N6 | Параллельно два Agent-чата с одним workflow + version | один получает `WORKFLOW_VERSION_CONFLICT`, recoverable |
| N7 | `MCP_ENABLED=false` + restart | `/mcp` недоступен; REST жив |

Логи сервера: есть `requestId`, нет JWT и raw tool arguments. Write/final tools пишут `[mcp:audit]`.

---

## 4. Что фиксировать по каждому прогону

Краткий лог (можно в issue / `ai_docs/develop/reports/`):

```text
Дата:
Объект / workflowId:
Смета (файл):
Пройденные этапы: A B C D E F G H
Упало на:
Код ошибки MCP:
requestId из лога:
Поведение агента (хорошо/плохо):
Нужен ли фикс tool/prompt/docs:
```

Разделяйте дефекты:
- **сервер/контракт** → баг в MCP/services
- **поведение модели** → усилить стартовые правила / prompt / описания tools
- **UX загрузки файлов** → ожидаемо неудобно в Cursor; для B заложить upload в UI

---

## 5. Definition of Done → можно начинать B

Отметить все пункты:

- [ ] Gate 0 и A–H зелёные на одном эталонном объекте
- [ ] Негативы N1–N7 пройдены
- [ ] Агент ни разу не сделал approve/final без явного «да» в логе диалога
- [ ] После «перезапуска чата» сценарий продолжается с текущего stage
- [ ] Список известных ограничений зафиксирован (линейный planner, ручной upload URL, и т.д.)
- [ ] Решение: UI B будет тонким клиентом поверх тех же services, без новой бизнес-логики

**Не начинать B**, если:
- агент стабильно перескакивает стадии или выдумывает inputs;
- final-действия проходят без confirm;
- ownership/auth дырявые;
- сценарий «живёт» только при ручных REST-вызовах между шагами.

---

## 6. После полировки: вход в вариант B

Когда DoD выполнен, B = новый экран «Ассистент», который:

1. держит transcript отдельно от Home-`messages`;
2. на user turn вызывает те же application services (не дублировать правила);
3. рендерит missingInputs / confirm gates / upload в UI;
4. Home оставляет журналом фактов работ.

Этот runbook остаётся регрессионным чеклистом: любой релиз MCP должен проходить этапы A–H в Cursor до включения UI-ассистента.
