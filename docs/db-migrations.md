## Миграции БД (вариант B — SQL)

### Источник истины
- **DB-изменения фиксируем SQL-миграциями** в папке `migrations/` (файлы `0001_*.sql`, `0002_*.sql`, ...).
- `shared/schema.ts` **держим синхронизированным** со схемой БД, но **не используем как инструмент применения** (не через `db:push`).

---

## Workflow работы с миграциями

### 1. `npm run db:generate` — только dev

Генерирует новый SQL-файл миграции из изменений в `shared/schema.ts` через `drizzle-kit generate`.

**Доступна только в dev-окружении** (`NODE_ENV !== 'production'`).  
При запуске в production команда завершается с ошибкой.

```bash
# Генерация новой миграции (только dev)
npm run db:generate
```

> Результат: создаётся новый файл `migrations/XXXX_*.sql`.  
> После этого рекомендуется проверить содержимое файла и при необходимости отредактировать вручную.

---

### 2. `npm run db:migrate` — dev + prod

Применяет все ещё не применённые SQL-миграции из папки `migrations/`.

```bash
# Применение миграций (dev и production)
npm run db:migrate
```

Требования:
- в `.env` должен быть указан `DATABASE_URL`.

Команда:
- читает `migrations/*.sql` лексикографически (`0001` → `0002` → ...),
- применяет только те, которые ещё не были применены,
- фиксирует применение в таблице `schema_migrations`.

---

### 3. `npm run db:push` — **ЗАПРЕЩЁН**

Команда `db:push` **отключена** и завершается с ошибкой при вызове.  
`drizzle-kit push` не записывает изменения в `schema_migrations`, создаёт рассинхрон с историей миграций.

```bash
# Запрещено — всегда возвращает ошибку
npm run db:push  # → ОШИБКА
```

---

### Как создать миграцию вручную
- Создай новый файл в `migrations/` с инкрементным номером:
  - пример: `migrations/0004_object_parties_add_sro_fields.sql`
- Внутри — обычный SQL `ALTER TABLE / CREATE TABLE / ...`.
- Правило: миграции должны быть **идемпотентными**, где это возможно:
  - `ADD COLUMN IF NOT EXISTS`
  - `CREATE TABLE IF NOT EXISTS`

### Где хранится история
В БД создаётся таблица:
- `schema_migrations(filename, applied_at)`

### После изменения БД
- обновить `shared/schema.ts`,
- обновить `shared/routes.ts` (если меняются DTO/контракты),
- обновить backend storage и UI.

---

## DOC-SCOPE rollout: `0026_documents_object_id.sql`

### Clean-chain fix: `0019_drop_legacy_telegram_columns.sql`

`0019` теперь идемпотентно назначает объектам без владельца явного legacy-пользователя перед `objects.user_id SET NOT NULL`.

Политика:
- пользователь создаётся как `Legacy System Owner`;
- email: `legacy-system-owner@local.invalid`;
- `role = 'admin'`, `is_blocked = true`;
- реальные пользователи не выбираются случайно.

### BL-001: preflight перед staging/prod

Без доступа к staging/prod локально можно проверить только структуру миграции и свежую БД. Перед применением на живых данных нужно выполнить read-only preflight в целевой БД:

```sql
SELECT scope, COUNT(*) AS total
FROM documents
WHERE deleted_at IS NULL
GROUP BY scope
ORDER BY scope;

WITH binding_objects AS (
  SELECT document_id, object_id
  FROM document_bindings
  WHERE object_id IS NOT NULL
  UNION
  SELECT db.document_id, pm.object_id
  FROM document_bindings db
  JOIN project_materials pm ON pm.id = db.project_material_id
  WHERE pm.object_id IS NOT NULL
  UNION
  SELECT db.document_id, mb.object_id
  FROM document_bindings db
  JOIN material_batches mb ON mb.id = db.batch_id
  WHERE mb.object_id IS NOT NULL
)
SELECT
  d.id,
  d.title,
  d.doc_number,
  COUNT(DISTINCT bo.object_id) AS binding_object_count
FROM documents d
LEFT JOIN binding_objects bo ON bo.document_id = d.id
WHERE d.scope = 'project'
  AND d.deleted_at IS NULL
GROUP BY d.id, d.title, d.doc_number
HAVING COUNT(DISTINCT bo.object_id) <> 1
ORDER BY d.id;
```

Если второй запрос возвращает строки, миграция `0026` soft-delete этих active `project` документов перед установкой CHECK и запишет причину в `documents.meta->'scopeMigration0026'`.

### BL-002: локальная реализация

Миграция `0026_documents_object_id.sql`:
- добавляет `documents.object_id`;
- ставит FK `documents_object_id_fkey` на `objects(id)` с `ON DELETE CASCADE`;
- добавляет индексы `documents_object_id_idx` и `documents_scope_object_idx`;
- backfill-ит `project` документы по `document_bindings.object_id`, `project_materials.object_id`, `material_batches.object_id`, если найден ровно один объект;
- active `project` документы без однозначного объекта soft-delete-ит и помечает в `meta.scopeMigration0026`;
- добавляет CHECK: active `global` документы должны иметь `object_id IS NULL`, active `project` документы должны иметь `object_id IS NOT NULL`.

Локальная проверка:

```bash
npm test -- tests/documents-object-scoping-implementation.test.ts
```

CI workflow `.github/workflows/test-migrations.yml` дополнительно применяет все миграции на чистой PostgreSQL и проверяет колонку, FK, CHECK и индексы для `documents.object_id`, а также audit-колонки из `0027`.

### `0027_documents_audit_user_ids.sql`

`0027` добавляет nullable ссылки:

- `documents.created_by_user_id -> users(id) ON DELETE SET NULL`;
- `documents.updated_by_user_id -> users(id) ON DELETE SET NULL`.

Для существующих project-документов автор создания заполняется из `objects.user_id`, если он известен. Для старых global-документов автор может остаться `NULL`, потому что безопасного источника истины нет.

### BL-016: postflight после staging/prod

После применения на staging/prod нужен read-only postflight:

```sql
SELECT COUNT(*) AS invalid_active_documents
FROM documents
WHERE deleted_at IS NULL
  AND NOT (
    (scope = 'global' AND object_id IS NULL)
    OR (scope = 'project' AND object_id IS NOT NULL)
  );

SELECT
  meta->'scopeMigration0026'->>'reason' AS reason,
  COUNT(*) AS total
FROM documents
WHERE meta ? 'scopeMigration0026'
GROUP BY reason
ORDER BY reason;
```

Ожидание: `invalid_active_documents = 0`. Строки во втором запросе требуют продуктового решения: восстановить документ в конкретный объект, оставить удалённым или перевести в global после ручной проверки.
