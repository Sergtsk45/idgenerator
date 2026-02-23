# Plan: Admin Panel — Панель администратора

**Created:** 2026-02-23  
**Orchestration:** orch-2026-02-23-admin-panel  
**Status:** ✅ Completed

---

## Goal

Реализовать минимально жизнеспособную панель администратора для Telegram MiniApp строительной документации.

**Scope MVP:**
1. Управление пользователями (список, блокировка, назначение роли admin)
2. Глобальный справочник материалов (CRUD через UI)
3. Мониторинг системы (статистика: пользователи, объекты, акты, сообщения)
4. Очередь AI-обработки (статусы, повторная обработка failed)

---

## Tasks

- [x] ADMIN-001: DB — таблица `admin_users` + поле `is_blocked` в `objects` + миграция (✅ Completed)
- [x] ADMIN-002: Backend — middleware `requireAdmin` + регистрация admin-роутов (✅ Completed)
- [x] ADMIN-003: Backend — Admin API: users, stats, messages queue (✅ Completed)
- [x] ADMIN-004: Backend — Admin API: materials catalog CRUD (✅ Completed)
- [x] ADMIN-005: Frontend — Admin layout + routing + auth guard (✅ Completed)
- [x] ADMIN-006: Frontend — Users management page (✅ Completed)
- [x] ADMIN-007: Frontend — System dashboard + messages queue (✅ Completed)
- [x] ADMIN-008: Frontend — Materials catalog management page (✅ Completed)

---

## Dependencies

```
ADMIN-001 ← блокирует ADMIN-002, ADMIN-003, ADMIN-004
ADMIN-002 ← блокирует ADMIN-003, ADMIN-004
ADMIN-003 ← блокирует ADMIN-006, ADMIN-007
ADMIN-004 ← блокирует ADMIN-008
ADMIN-005 ← параллельно с ADMIN-003/004 (только layout)
```

**Порядок:** ADMIN-001 → ADMIN-002 → ADMIN-003 → ADMIN-004 → ADMIN-005 → ADMIN-006 → ADMIN-007 → ADMIN-008

---

## Architecture Decisions

### Идентификация администратора
- Таблица `admin_users` хранит `telegram_user_id` (строка) администраторов
- Middleware `requireAdmin` проверяет `req.telegramUser.id` против таблицы
- В dev-режиме (без BOT_TOKEN): принимать `X-Admin-Override: true` заголовок (только если `NODE_ENV !== 'production'`)
- Первый admin добавляется через SQL напрямую или env-переменную `ADMIN_TELEGRAM_IDS=123,456`

### URL-структура
- Все admin API: `/api/admin/*` — защищены `requireAdmin`
- Frontend: `/admin` — отдельная страница (не в MiniApp BottomNav)
- Доступ к `/admin` открывается через настройки (Settings) или прямую ссылку

### Безопасность
- `requireAdmin` вызывается ПОСЛЕ `telegramAuth` middleware
- В prod без валидного Telegram initData — 401
- Не-admin — 403
- Все admin-операции логируются в консоль сервера (MVP; audit log в будущем)

---

## Detailed Tasks

### ADMIN-001: DB — таблица admin_users + миграция

**Файлы:**
- `migrations/0013_admin_panel.sql` — новая SQL-миграция
- `shared/schema.ts` — добавить таблицу `adminUsers`

**SQL:**
```sql
-- Таблица администраторов
CREATE TABLE IF NOT EXISTS admin_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_user_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE INDEX IF NOT EXISTS admin_users_telegram_user_id_idx ON admin_users(telegram_user_id);

-- Флаг блокировки пользователя
ALTER TABLE objects ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- Заполнить первых admin из env ADMIN_TELEGRAM_IDS (делается в сервере, не в миграции)
```

**Acceptance Criteria:**
- [ ] Миграция применяется без ошибок на существующей БД
- [ ] `npm run check` проходит

---

### ADMIN-002: Backend — middleware requireAdmin

**Файлы:**
- `server/middleware/adminAuth.ts` — новый middleware
- `server/index.ts` или `server/routes.ts` — регистрация admin-роутов

**Логика `requireAdmin`:**
```typescript
// Вызывается после telegramAuth
// Проверяет: req.telegramUser?.id в таблице admin_users
// В dev (NODE_ENV !== 'production'): также принимает заголовок X-Admin-Override: true
```

**Acceptance Criteria:**
- [ ] В prod: не-admin получает 403
- [ ] В dev: можно использовать X-Admin-Override заголовок
- [ ] `npm run check` проходит

---

### ADMIN-003: Backend — Admin API: users, stats, messages queue

**Файлы:**
- `server/routes.ts` — добавить admin-роуты
- `server/storage.ts` — добавить методы для admin

**Эндпоинты:**
- `GET /api/admin/users` — список всех пользователей (telegram_user_id из objects + is_blocked + counts)
- `POST /api/admin/users/:telegramUserId/block` — заблокировать
- `POST /api/admin/users/:telegramUserId/unblock` — разблокировать
- `POST /api/admin/users/:telegramUserId/make-admin` — назначить admin
- `DELETE /api/admin/users/:telegramUserId/admin` — снять admin
- `GET /api/admin/stats` — системная статистика
- `GET /api/admin/messages/failed` — сообщения со статусом failed/not processed
- `POST /api/admin/messages/:id/reprocess` — повторная обработка

**Acceptance Criteria:**
- [ ] Все эндпоинты защищены requireAdmin
- [ ] `npm run check` проходит

---

### ADMIN-004: Backend — Admin API: materials catalog CRUD

**Файлы:**
- `server/routes.ts` — admin material catalog routes
- `server/storage.ts` — admin storage methods

**Эндпоинты:**
- `POST /api/admin/materials-catalog` — создать позицию в каталоге
- `PATCH /api/admin/materials-catalog/:id` — обновить
- `DELETE /api/admin/materials-catalog/:id` — удалить

**Acceptance Criteria:**
- [ ] CRUD работает для глобального каталога
- [ ] Защита requireAdmin
- [ ] `npm run check` проходит

---

### ADMIN-005: Frontend — Admin layout + routing

**Файлы:**
- `client/src/pages/admin/AdminLayout.tsx` — layout с sidebar
- `client/src/pages/admin/AdminPage.tsx` — redirect to /admin/dashboard
- `client/src/pages/admin/AdminDashboard.tsx` — placeholder
- `client/src/hooks/use-admin.ts` — хуки для admin API
- `client/src/lib/queryClient.ts` — проверить передачу X-Admin-Override в dev
- `client/src/main.tsx` или `App.tsx` — добавить роут /admin/*

**UI:**
- Sidebar с навигацией: Dashboard / Users / Materials / Messages
- Заголовок "Admin Panel" с иконкой щита
- Breadcrumb навигация
- Graceful 403 fallback "Доступ запрещён"

**Acceptance Criteria:**
- [ ] `/admin` открывается и показывает layout
- [ ] Неавторизованный пользователь видит сообщение об ошибке
- [ ] `npm run check` проходит

---

### ADMIN-006: Frontend — Users management page

**Файлы:**
- `client/src/pages/admin/AdminUsers.tsx`
- `client/src/hooks/use-admin.ts` — хуки useAdminUsers, useBlockUser, useMakeAdmin

**UI:**
- Таблица/список пользователей: Telegram ID | Объекты | Акты | Статус | Действия
- Кнопки: Заблокировать / Разблокировать / Назначить Admin
- Бейдж "ADMIN" рядом с именем
- Фильтр: Все / Заблокированные / Adminы

**Acceptance Criteria:**
- [ ] Список загружается с сервера
- [ ] Блокировка / разблокировка работает без перезагрузки (optimistic update)
- [ ] `npm run check` проходит

---

### ADMIN-007: Frontend — System dashboard + messages queue

**Файлы:**
- `client/src/pages/admin/AdminDashboard.tsx`
- `client/src/pages/admin/AdminMessages.tsx`
- `client/src/hooks/use-admin.ts` — хуки useAdminStats, useFailedMessages, useReprocessMessage

**Dashboard UI:**
- 4 карточки метрик: Пользователи / Объекты / Акты / Сообщений
- График тренда (опционально, MVP: просто числа)

**Messages Queue UI:**
- Список необработанных/failed сообщений
- Кнопка "Повторить обработку" для каждого
- Статус-бейдж: pending / processed / failed

**Acceptance Criteria:**
- [ ] Статистика загружается
- [ ] Reprocess запускает повторную AI-обработку
- [ ] `npm run check` проходит

---

### ADMIN-008: Frontend — Materials catalog management

**Файлы:**
- `client/src/pages/admin/AdminMaterials.tsx`
- `client/src/hooks/use-admin.ts` — хуки useAdminCreateMaterial, useAdminUpdateMaterial, useAdminDeleteMaterial

**UI:**
- Список материалов глобального каталога с поиском
- Кнопка "Добавить материал" → инлайн форма или диалог
- Редактирование позиции
- Удаление с подтверждением

**Acceptance Criteria:**
- [ ] CRUD работает для глобального каталога
- [ ] Поиск фильтрует по названию
- [ ] `npm run check` проходит

---

## Estimated Scope

| Задача | Сложность | Файлов | Приоритет |
|--------|-----------|--------|-----------|
| ADMIN-001 | Низкая | 2 | P0 |
| ADMIN-002 | Низкая | 1 | P0 |
| ADMIN-003 | Средняя | 2 | P0 |
| ADMIN-004 | Низкая | 1 | P1 |
| ADMIN-005 | Средняя | 4–5 | P0 |
| ADMIN-006 | Средняя | 2 | P1 |
| ADMIN-007 | Средняя | 3 | P1 |
| ADMIN-008 | Средняя | 2 | P1 |
