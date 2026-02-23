# Plan: MVP — Изоляция данных пользователя и UX-доработки

**Created:** 2026-02-23  
**Orchestration:** orch-2026-02-23-mvp-isolation  
**Status:** ⏳ Pending

---

## Goal

Устранить критические пробелы в MVP, мешающие реальному использованию приложения несколькими пользователями:
1. Привязать журнал работ (messages) к конкретному пользователю Telegram, а не к хардкоду `"user_123"`
2. Изолировать данные пользователя на сервере (фильтрация по userId / objectId)
3. Привязать сообщения к текущему объекту строительства
4. Дать пользователю минимальную ориентацию: фильтры в графике и onboarding-баннер

---

## Tasks

- [ ] MVP-001: Заменить hardcoded userId на Telegram userId (⏳ Pending)
- [ ] MVP-002: Серверная фильтрация сообщений по userId (⏳ Pending)
- [ ] MVP-003: Добавить objectId в messages + SQL-миграция (⏳ Pending)
- [ ] MVP-004: Минимальные фильтры на экране /schedule (⏳ Pending)
- [ ] MVP-005: Onboarding-баннер на главной странице (⏳ Pending)

---

## Dependencies

```
MVP-001 ← блокирует MVP-002 (нужен правильный userId на клиенте, чтобы тестировать серверную фильтрацию)
MVP-002 ← выполняется параллельно / перед MVP-003 (оба меняют server/routes.ts + storage.ts)
MVP-003 ← зависит от MVP-002 (расширяет фильтрацию с userId до objectId)
MVP-004 ← независима
MVP-005 ← независима
```

**Порядок выполнения:** MVP-001 → MVP-002 → MVP-003 → (MVP-004 и MVP-005 параллельно)

---

## Detailed Tasks

### MVP-001: Заменить hardcoded userId на Telegram userId

**Файлы:**
- `client/src/pages/Home.tsx`
- `client/src/hooks/useTelegram.ts` (только читать)
- `client/src/lib/telegram.ts` (только читать)

**Что делаем:**
1. В `Home.tsx` заменить `const currentUser = "user_123"` на `const { user } = useTelegram()`.
2. Использовать `userId = user?.id ? String(user.id) : "dev_" + getOrCreateDevUserId()`.
3. Создать вспомогательную функцию `getOrCreateDevUserId()` в `client/src/lib/telegram.ts` — генерирует уникальный ID и сохраняет в `localStorage` (чтобы при перезагрузке dev-пользователь оставался тем же).

**Acceptance Criteria:**
- [ ] В Telegram MiniApp userId берётся из `Telegram.WebApp.initDataUnsafe.user.id`
- [ ] В dev-браузере (без Telegram) используется стабильный `dev_XXXX` из localStorage
- [ ] `npm run check` проходит без ошибок

---

### MVP-002: Серверная фильтрация сообщений по userId

**Файлы:**
- `server/routes.ts` — маршруты GET/POST/PATCH/process для messages
- `server/storage.ts` — метод `getMessages(userId?: string)`
- `shared/schema.ts` — таблица messages (убедиться, что поле userId есть)

**Что делаем:**
1. `GET /api/messages` — добавить извлечение userId из `req.telegramUser?.id` (middleware telegramAuth уже устанавливает `req.telegramUser`). Передавать в `storage.getMessages(userId)`.
2. `POST /api/messages` — при создании записи игнорировать `req.body.userId` и использовать `req.telegramUser?.id ?? req.body.userId` (в dev без токена — принять из тела как fallback).
3. `PATCH /api/messages/:id` и `POST /api/messages/:id/process` — проверять, что message принадлежит текущему пользователю (security).
4. `storage.getMessages(userId?: string)` — добавить `WHERE user_id = userId` если userId передан.
5. `storage.getMessage(id, userId?)` — аналогично для одного сообщения.

**Acceptance Criteria:**
- [ ] Два разных пользователя видят только свои сообщения
- [ ] В dev-режиме (без BOT_TOKEN) фильтрация работает по userId из тела запроса
- [ ] Нельзя отредактировать/обработать чужое сообщение (403)
- [ ] `npm run check` проходит

---

### MVP-003: Добавить objectId в messages + SQL-миграция

**Файлы:**
- `migrations/0013_messages_object_id.sql` — новая SQL-миграция
- `shared/schema.ts` — добавить поле `objectId` в таблицу `messages`
- `server/routes.ts` — передавать objectId при создании
- `server/storage.ts` — фильтровать getMessages по objectId

**Что делаем:**
1. Создать миграцию `0013_messages_object_id.sql`:
   ```sql
   ALTER TABLE messages ADD COLUMN IF NOT EXISTS object_id integer REFERENCES objects(id) ON DELETE SET NULL;
   CREATE INDEX IF NOT EXISTS messages_object_id_idx ON messages(object_id);
   CREATE INDEX IF NOT EXISTS messages_user_id_idx ON messages(user_id);
   ```
2. В `shared/schema.ts` добавить в таблицу `messages` поле `objectId: integer("object_id").references(() => objects.id)`.
3. В `server/routes.ts` при `POST /api/messages`: резолвить текущий объект пользователя через `storage.getOrCreateDefaultObject(telegramUserId)` и сохранять `objectId`.
4. В `GET /api/messages`: фильтровать по objectId текущего объекта (если objectId передан как query param или определяется из текущего объекта пользователя).
5. В `GET /api/worklog/section3` — аналогично фильтровать messages по objectId.

**Acceptance Criteria:**
- [ ] Миграция применяется без ошибок на чистой БД (`npm run db:migrate`)
- [ ] Новые сообщения сохраняются с objectId текущего объекта пользователя
- [ ] Раздел 3 ЖР показывает только сообщения текущего объекта
- [ ] `npm run check` проходит

---

### MVP-004: Минимальные фильтры на экране /schedule

**Файлы:**
- `client/src/pages/Schedule.tsx`

**Что делаем:**
1. Заменить кнопку "Фильтры" (сейчас без логики) на pill-переключатель с тремя состояниями:
   - **Все** — показывает все задачи
   - **Без акта №** — показывает задачи где `task.actNumber == null`  
   - **С актом №** — показывает задачи где `task.actNumber != null`
2. Добавить `useState<'all' | 'without-act' | 'with-act'>('all')` для фильтра.
3. Применять фильтр к `tasks` через `useMemo`.
4. Pill-переключатель: компактный, inline, рядом с навигацией по месяцу.

**Acceptance Criteria:**
- [ ] Три состояния фильтра работают корректно
- [ ] При смене фильтра диаграмма Ганта обновляется без перезагрузки
- [ ] Кнопка "Фильтры" больше не является "пустой заглушкой"
- [ ] `npm run check` проходит

---

### MVP-005: Onboarding-баннер на главной странице

**Файлы:**
- `client/src/pages/Home.tsx`
- `client/src/hooks/use-works.ts` (только читать)
- `client/src/hooks/use-schedules.ts` (только читать)

**Что делаем:**
1. На главной странице (`/`) проверять: если messages пустые И works пустые — показывать onboarding-карточку "Начните работу".
2. Карточка содержит 3-4 шага в виде пронумерованного списка:
   - **1.** Заполните исходные данные объекта → `[Перейти →]` ссылка на `/source-data`
   - **2.** Импортируйте ВОР или Смету → `[Перейти →]` ссылка на `/works`  
   - **3.** Постройте график и назначьте акты → `[Перейти →]` ссылка на `/schedule`
   - **4.** Генерируйте акты и скачивайте PDF → `[Перейти →]` ссылка на `/acts`
3. Карточку можно скрыть кнопкой "×" с сохранением в localStorage (`onboarding_dismissed`).
4. Стиль: `bg-card border rounded-2xl p-4`, цвет иконок шагов — primary.

**Acceptance Criteria:**
- [ ] Карточка показывается только когда нет ни сообщений, ни работ ВОР
- [ ] Каждая ссылка ведёт на нужную страницу
- [ ] После нажатия "×" карточка скрывается и не возвращается после перезагрузки
- [ ] `npm run check` проходит

---

## Architecture Notes

### Безопасность userId
Нельзя доверять `req.body.userId` в production. Middleware `telegramAuth` (уже реализован в `server/middleware/telegramAuth.ts`) устанавливает `req.telegramUser` из валидированного HMAC-подписанного initData. В dev-режиме (нет TELEGRAM_BOT_TOKEN) middleware пропускает запрос, поэтому нужен явный fallback — принимать userId из тела только если `NODE_ENV !== 'production'`.

### Dev-идентификация пользователя
Для стабильной работы в dev (браузер без Telegram) создаём ID вида `dev_XXXXXXXX` (8 hex-символов случайно, сохраняется в localStorage) — чтобы при перезагрузке страницы dev-пользователь не терял свои данные.

### Миграция 0013
Поля `object_id` добавляются с `ON DELETE SET NULL` — чтобы при удалении объекта сообщения не исчезали, а просто теряли привязку.

### Фильтры в Schedule
Фильтрация задач происходит только на клиенте (данные уже загружены), без дополнительных API-запросов. Это MVP-подход, достаточный для текущего масштаба.

---

## Estimated Scope

| Задача | Сложность | Файлов | Приоритет |
|--------|-----------|--------|-----------|
| MVP-001 | Низкая | 2 | P0 |
| MVP-002 | Средняя | 3 | P0 |
| MVP-003 | Средняя | 4 + миграция | P0 |
| MVP-004 | Низкая | 1 | P1 |
| MVP-005 | Низкая | 1 | P1 |
