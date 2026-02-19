# Bootstrap: разворачивание с нуля

Этот документ описывает полный сценарий первого запуска приложения на чистой машине / чистой БД.

---

## Требования

| Компонент     | Версия     |
|---------------|------------|
| Node.js       | ≥ 20       |
| PostgreSQL     | ≥ 14       |
| npm           | ≥ 10       |

---

## 1. Клонирование и зависимости

```bash
git clone <repo-url>
cd TelegramJurnalRabot
npm ci
```

---

## 2. База данных

### 2a. Запуск Postgres через Docker (рекомендуется)

```bash
docker run -d \
  --name journal-pg \
  -e POSTGRES_USER=journal \
  -e POSTGRES_PASSWORD=journal \
  -e POSTGRES_DB=journal \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2b. Или вручную (уже установленный Postgres)

```sql
-- выполнить от пользователя postgres:
CREATE USER journal WITH PASSWORD 'journal';
CREATE DATABASE journal OWNER journal;
```

---

## 3. Переменные окружения

Создайте файл `.env` в корне проекта:

```env
DATABASE_URL=postgresql://journal:journal@localhost:5432/journal
# Добавьте остальные переменные при необходимости (TELEGRAM_BOT_TOKEN, OPENAI_API_KEY и др.)
```

> **Безопасность**: никогда не коммитьте `.env` в git. Файл уже внесён в `.gitignore`.

---

## 4. Применение миграций

```bash
npm run build        # собирает dist/db-migrate.cjs
npm run db:migrate   # применяет все SQL из migrations/ по порядку
```

Успешный вывод выглядит примерно так:

```
[db:migrate] applying: 0000_initial_schema.sql
[db:migrate] applied:  0000_initial_schema.sql
[db:migrate] applying: 0001_objects_source_data.sql
[db:migrate] applied:  0001_objects_source_data.sql
...
[db:migrate] done. Applied 12 migration(s).
```

### Проверка схемы (psql)

```bash
psql "$DATABASE_URL" -c "\dt"
```

Должны присутствовать таблицы:

```
 act_template_selections
 act_templates
 acts
 attachments
 messages
 objects
 schedule_tasks
 schedules
 schema_migrations
 works
 (и другие, добавленные последующими миграциями)
```

Контрольные SELECT:

```sql
SELECT count(*) FROM works;
SELECT count(*) FROM acts;
SELECT count(*) FROM messages;
SELECT filename, applied_at FROM schema_migrations ORDER BY filename;
```

---

## 5. Запуск приложения

```bash
# Режим разработки
npm run dev

# Production (после npm run build)
npm start
```

---

## 6. Устранение проблем

| Симптом | Причина | Решение |
|---------|---------|---------|
| `tsx: not found` при `db:migrate` | Забыли выполнить `npm run build` | Сначала `npm run build`, затем `npm run db:migrate` |
| `relation "works" does not exist` | Миграции не применены | Выполнить шаг 4 |
| `Missing required env: DATABASE_URL` | Нет `.env` файла | Создать `.env` по шаблону выше |
| `ECONNREFUSED` к Postgres | Postgres не запущен | Запустить контейнер / сервис Postgres |

---

## 7. Как работает мигратор

- Скрипт `script/db-migrate.ts` компилируется в `dist/db-migrate.cjs` командой `npm run build`.
- При запуске читает `migrations/*.sql` в лексикографическом порядке (`0000` → `0001` → ...).
- Создаёт таблицу `schema_migrations` и пропускает уже применённые файлы.
- Каждая миграция оборачивается в транзакцию — при ошибке делается ROLLBACK.

Подробнее: [`docs/db-migrations.md`](./db-migrations.md)
