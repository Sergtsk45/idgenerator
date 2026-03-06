# TelegramJurnalRabot — описание проекта

## Назначение
**TelegramJurnalRabot** — mobile-first веб-приложение (ориентировано на **Telegram MiniApp**) для автоматизации строительной документации, в частности формирования **АОСР** (Акты освидетельствования скрытых работ) на основе:
- ведомости объёмов работ (**ВОР/ВОИР**, Bill of Quantities / BoQ), импортируемой из Excel;
- журнала сообщений о выполненных работах (текстовые записи и голосовой ввод с транскрипцией через OpenAI Whisper);
- нормализации сообщений с помощью AI (OpenAI) в структурированные данные;
- агрегации нормализованных записей в акты за выбранный период.

## Ключевые сценарии (как сейчас)
- **Импорт ВОР из Excel**: пользователь загружает `.xlsx`, клиент парсит файл и отправляет позиции на сервер одним запросом `POST /api/works/import` в режиме **merge** (без авто-удаления данных).
- **Импорт Сметы/ЛСР из Excel (ГРАНД‑Смета)**: на экране `/works` пользователь переключается в режим "Смета", загружает `.xlsx`; клиент парсит выгрузку (поиск строки заголовка `№ п/п / Обоснование / Наименование работ и затрат`, разбор позиций/ресурсов) и отправляет JSON на `POST /api/estimates/import`. Смета хранится отдельными таблицами и отображается на вкладке ВОР.
- **Импорт материалов из PDF-счётов** (новое): пользователь загружает PDF-счёт поставщика на вкладке "Локальные" материалов; сервер отправляет файл в микросервис invoice-extractor, который парсит таблицу материалов и возвращает структурированные данные; пользователь просматривает таблицу в диалоге, может отредактировать данные и подтвердить импорт.
- **Массовый импорт материалов из Excel**: администраторы могут загружать справочник материалов в глобальный каталог через админ-панель. Клиент парсит Excel-файл (колонки: №, Наименование, Ед. изм., ГОСТ/ТУ, Категория) и отправляет JSON на `POST /api/admin/materials-catalog/import` в режиме **merge** (дедупликация по названию, case-insensitive). Полное руководство в `docs/materials-import-guide.md`.
- **Журнал работ**: пользователь отправляет сообщение о выполненной работе; сервер сохраняет raw-текст и пытается извлечь структуру через OpenAI (workCode/quantity/date/location и т.д.).
- **Генерация актов АОСР (только из графика работ)**: на экране `/schedule` для задачи задаются:
  - `actNumber` — номер акта (уникальный бизнес‑идентификатор),
  - `actTemplateId` — тип акта (шаблон из каталога),
  - документация/схемы (`projectDrawings`, `normativeRefs`, `executiveSchemes`),
  - материалы задачи (через `task_materials`).
  По кнопке "Сформировать/обновить акты из графика" сервер:
  - группирует задачи по `actNumber`,
  - вычисляет `dateStart/dateEnd`,
  - формирует `worksData` по источнику графика (ВОР/Смета),
  - переносит материалы задач в `act_material_usages` (п.3) и `act_document_attachments` (приложения),
  - агрегирует чертежи/нормативы/схемы в поля акта,
  - удаляет акты, для которых не осталось задач.
- **Разделение задач графика (Split Task)**: пользователь выбирает задачу, разбивает её на 2+ последовательные задачи ("захватки") с независимыми сроками и номерами актов. Функция поддерживает множественное разделение — уже разделённая задача может быть разделена снова (N захваток).
  - **Процесс разделения**:
    - Дата разделения задаёт границу между частями (валидация: строго внутри диапазона задачи)
    - Объём (`quantity`) распределяется вручную между двумя частями (сумма должна соответствовать исходному объёму)
    - Длительности (`durationDays`) вычисляются автоматически из новых диапазонов
    - Вторая часть вставляется в график сразу после первой (`orderIndex + 1`), остальные задачи сдвигаются
    - Пользователь выбирает, какие данные копировать во вторую часть: ☑/☐ Материалы, ☑/☐ Проектная документация, ☑/☐ Нормативные ссылки, ☑/☐ Исполнительные схемы
    - Каждая захватка получает свой `actNumber` (номер акта для второй части задаётся при разделении)
  - **Toggle "Независимые материалы" (`independentMaterials`)**:
    - Управляет синхронизацией материалов И документации ПОСЛЕ разделения (при добавлении/удалении новых данных)
    - Отображается только для задач с `split_group_id IS NOT NULL`
    - **Галочка ВЫКЛ** (`independentMaterials = false`, по умолчанию):
      - Добавление материала/документа качества → автоматически добавляется во все задачи группы с флагом `false`
      - Удаление материала/документа → каскадирует на все задачи группы с флагом `false`
      - Изменение `projectDrawings`, `normativeRefs`, `executiveSchemes` → обновляется у всех задач группы с флагом `false`
      - Режим "общие материалы/документация на все захватки"
    - **Галочка ВКЛ** (`independentMaterials = true`):
      - Добавление/удаление материалов/документации затрагивает только эту конкретную задачу
      - Изолированный режим: "свои материалы/документация для этой захватки"
  - **Генерация актов**: без изменений в логике — каждая захватка имеет свой `actNumber` → группируется в свой акт со своими сроками (`dateStart`/`dateEnd`) и материалами
- **Экспорт PDF АОСР**: `POST /api/acts/:id/export` генерирует один или несколько PDF по выбранным шаблонам. Для АОСР используется pdfmake-шаблон `server/templates/aosr/aosr-template.json` с плейсхолдерами `{{...}}` (в эталонном варианте под `005_АОСР 4.pdf` материалы и приложения формируются **текстом**, а не таблицей; данные приходят через `formData`).

## Архитектура (высокоуровневая)

### Компоненты
- **Frontend**: React + TypeScript, маршрутизация через Wouter, server-state через TanStack Query, локальное состояние (язык) через Zustand, UI на Tailwind + shadcn/ui, анимации Framer Motion.
- **Telegram MiniApp**: Полная интеграция с Telegram WebApp API:
  - **SDK**: `telegram-web-app.js` подключен в `index.html`, инициализация через `WebApp.ready()` и `WebApp.expand()`
  - **TypeScript типы**: `client/src/types/telegram.d.ts` — полные типы для Telegram WebApp API
  - **Аутентификация**: 
    - Серверная валидация `initData` через middleware `server/middleware/telegramAuth.ts` (HMAC-SHA-256 с Bot Token)
    - Клиент автоматически передаёт `initData` в заголовке `X-Telegram-Init-Data` (см. `client/src/lib/queryClient.ts`)
    - Данные пользователя привязываются к внутреннему `users.id` через таблицу `auth_providers`
    - Документация: `docs/telegram-auth-testing.md`, скрипт для тестирования: `scripts/generate-mock-initdata.js`
    - **Доступ в браузере (вне Telegram)**:
      - Реализована мультипровайдерная аутентификация через JWT (email/phone/telegram)
      - Экран входа: `/login`, регистрации: `/register` (`client/src/pages/Login.tsx`, `Register.tsx`)
      - JWT токен хранится в localStorage и автоматически добавляется в заголовок `Authorization: Bearer <token>`
      - Таблицы: `users` (внутренний реестр), `auth_providers` (привязки провайдеров к пользователям)
  - **Хуки**: 
    - `useTelegram()` — доступ к WebApp, user, initData, themeParams, colorScheme
    - `useTelegramMainButton()` — управление главной кнопкой действия (см. `docs/telegram-buttons-guide.md`)
    - `useTelegramBackButton()` — управление кнопкой "Назад"
    - `useTelegramHaptic()` — тактильная обратная связь (impact/notification/selectionChanged, см. `docs/telegram-haptic-guide.md`)
  - **Тема**: `TelegramThemeProvider` автоматически применяет тему Telegram, CSS-переменные (`--tg-theme-*`)
  - **Бот**: Инструкция по созданию и настройке бота в `docs/telegram-bot-setup.md`
- **Invoice Extractor** (микросервис): Python/Flask сервис для парсинга PDF-счетов поставщиков
  - **Расположение**: `services/invoice-extractor/`
  - **Функции**: извлечение таблиц материалов из PDF, структурирование в JSON
  - **Docker**: образ с Python 3.10+, портированный на `5050:5000` через docker-compose
  - **API**: `POST /parse` — загрузка PDF (multipart/form-data), возврат структурированного JSON с таблицами
  - **Интеграция**: backend proxy `POST /api/parse-invoice` с multer, SSRF-защита, rate-limiting
- **Backend**: Express + TypeScript. REST API с типами/валидацией на базе `shared/routes.ts` (Zod).
- **База данных**: PostgreSQL + Drizzle ORM. Схема описана в `shared/schema.ts`.
- **AI**: OpenAI API (через переменные окружения интеграции), используется для нормализации сообщений.
- **Навигация UI**: основные разделы в `BottomNav`, доступ к `Settings` — через выпадающее меню "гамбургера" в `Header`.
  - Порядок вкладок `BottomNav` (слева направо): **ВОР → График работ → Акты → ЖР → Исходные**
  - **Главная** (`/`) вынесена в кнопку в правом верхнем углу `Header` (иконка микрофона).

### Диаграмма взаимодействий
```mermaid
flowchart LR
  UI[React MiniApp UI] -->|REST| API[Express API]
  API --> DB[(PostgreSQL)]
  API -->|OpenAI Chat Completions| AI[OpenAI]
  API -->|PDF parse| IE[Invoice Extractor]

  subgraph Auth
    DB --> U[users]
    DB --> AP[auth_providers]
  end
  
  subgraph Data
    DB --> W[works (BoQ)]
    DB --> E[estimates (LSR)]
    DB --> M[messages (raw + normalized)]
    DB --> A[acts (aggregated)]
    DB --> AT[attachments]
    DB --> MC[materials_catalog]
    DB --> PMat[project_materials]
    DB --> MBa[material_batches]
    DB --> Docs[documents]
    DB --> DBind[document_bindings]
    DB --> AMU[act_material_usages]
    DB --> ADA[act_document_attachments]
    DB --> S[schedules (gantt)]
    DB --> ST[schedule_tasks (gantt + split)]
    DB --> EPML[estimate_position_material_links]
    DB --> O[objects (construction objects)]
    DB --> OP[object_parties]
    DB --> ORP[object_responsible_persons]
  end
```

## Структура репозитория (важное)
- `client/` — фронтенд (Vite root)
  - `client/src/pages/*` — страницы: `Works` (ВОР/ВОИР), `Schedule` (график работ), `Home` (главная/чат-журнал), `Acts` (акты), `WorkLog` (ЖР/ОЖР), `Settings` (язык), `SourceData` (исходные), `SourceMaterials`/`SourceMaterialDetail` (материалы), `SourceDocuments` (документы качества).
    - `SourceData` (`/source-data`) — "дашборд" исходных данных: sticky-текущий объект + адрес, горизонтальные карточки сторон и карточки-разделы (материалы/документы/исполнительные/протоколы) + блок реквизитов/ответственных для редактирования.
  - `client/src/components/*` — общие компоненты (включая нижнюю навигацию).
  - `client/src/hooks/*` — react-query хуки для API.
  - `client/src/lib/*` — queryClient, i18n, utils.
  - `client/src/lib/materialsParser.ts` — парсер Excel-файла для импорта материалов.
- `server/` — бэкенд (Express)
  - `server/index.ts` — входная точка, в dev подключает Vite middleware, в prod — статические файлы из `dist/public`.
  - `server/routes.ts` — регистрация API роутов для works/messages/acts/admin.
  - `server/storage.ts` — слой доступа к данным (Drizzle).
  - `server/db.ts` — подключение к Postgres через `DATABASE_URL`.
  - `server/pdfGenerator.ts` — генерация PDF (pdfmake), включая АОСР по шаблону `server/templates/aosr/aosr-template.json`.
  - `server/templates/aosr/` — шаблоны и каталог шаблонов актов (`aosr-template.json`, `templates-catalog.json`).
  - `server/replit_integrations/*` — заготовки интеграций (чат, генерация изображений, batch-утилиты).
  - `server/middleware/adminAuth.ts` — middleware для проверки admin-роли при доступе к защищённым endpoint'ам.
- `shared/` — общий код для frontend/backend
  - `shared/schema.ts` — Drizzle таблицы + Zod-схемы/типы.
  - `shared/routes.ts` — контракт API (пути, методы, схемы).
- `attached_assets/GESN/` — утилита для парсинга справочников ГЭСН (PDF → SQLite) на Python.
  - Скрипт: `attached_assets/GESN/gesn_pdf_to_sqlite.py`
  - Результат: SQLite-файл (`--db`) и лог (`--log`). При относительном пути файлы сохраняются рядом со скриптом (в `attached_assets/GESN/`).

## Аутентификация (мультипровайдерная система)

### Архитектура
Система поддерживает несколько провайдеров аутентификации через единый интерфейс:
- **Telegram**: Вход в Telegram MiniApp через initData → валидация на сервере → JWT токен
- **Email/Password**: Регистрация и вход через браузер → хеширование пароля (bcrypt) → JWT токен
- **Готовность к расширению**: Phone, OAuth2 (Google, GitHub и т.д.)

### JWT токены
- **Алгоритм**: HS256
- **Срок жизни**: 7 дней (настраивается через `JWT_EXPIRES_IN`)
- **Хранение на клиенте**: localStorage
- **Отправка**: автоматически в заголовке `Authorization: Bearer <token>`

### Компоненты
- **`server/auth-service.ts`**: центральный сервис с методами:
  - `hashPassword()` / `verifyPassword()` — bcrypt (rounds=12)
  - `generateJWT()` / `verifyJWT()` — JWT операции
  - `findOrCreateUserByProvider()` — поиск/создание пользователя через провайдера
  - `validateTelegramAuthDate()` — проверка свежести Telegram auth_date (< 600 сек)
- **`server/middleware/auth.ts`**: unified middleware с поддержкой JWT, Telegram initData, legacy browser token
- **`server/routes/auth.ts`**: API endpoints регистрации/входа/профиля
- **`client/src/lib/auth.ts`**: утилиты для работы с JWT на клиенте
- **`client/src/hooks/use-auth.ts`**: React Query хуки для аутентификации
- **Таблицы БД**:
  - `users` — реестр пользователей (id, email, password_hash, role, isBlocked, createdAt, updatedAt)
  - `auth_providers` — привязки провайдеров (userId, provider: 'telegram'|'email', providerUserId, linkedAt)

### API endpoints
- `POST /api/auth/register` — регистрация по email/паролю
- `POST /api/auth/login` — вход по email/паролю
- `POST /api/auth/login/telegram` — вход через Telegram (POST initData → JWT)
- `GET /api/auth/me` — информация о текущем пользователе
- `POST /api/auth/link-provider` — привязка дополнительного провайдера к существующему аккаунту

### Rate limiting
- `/auth/login` — 5 попыток/минута на IP
- `/auth/register` — 3 попытки/час на IP

### Безопасность
- Пароли хешируются через bcrypt (cost factor 12)
- JWT секрет обязателен в production (`JWT_SECRET` env, >= 32 символа)
- Telegram auth_date проверяется на свежесть (защита от replay)
- Rate limiting защищает от brute force атак
- Поддержка блокировки пользователей (`users.isBlocked`)

### Миграция с legacy системы
Существующие пользователи Telegram автоматически мигрированы:
- SQL миграция `0018_users_auth_providers.sql` — создание таблиц users и auth_providers, копирование данных
- SQL миграция `0019_drop_legacy_telegram_columns.sql` — удаление legacy колонок (admin_users, telegram_user_id)

## Модель данных (текущее состояние)
Основные таблицы:
- `users`: реестр пользователей системы (id, email, password_hash, role, isBlocked, created_at, updated_at, **tariff, subscription_ends_at, trial_used**)
- `auth_providers`: привязки провайдеров (id, user_id, provider, provider_user_id, linked_at)
- `objects`: объект строительства (MVP: один «текущий объект» на пользователя), используется как якорь для исходных данных плейсхолдеров. Связь с пользователем через `users.id`.
- `object_parties`: стороны объекта (заказчик/подрядчик/проектировщик) с реквизитами (минимум — `fullName`, дополнительно — ИНН/КПП/ОГРН, юр.адрес, телефон, email, реквизиты СРО). Эти данные используются при экспорте АОСР в PDF (если не переопределены через `formData`).
- `object_responsible_persons`: ответственные лица/подписанты по ролям (ФИО/должность/основание + опционально line/sign).
- `materials_catalog`: глобальный справочник материалов (наименование, ГОСТ/ТУ, ед. изм., параметры). Импортируется администраторами через API `POST /api/admin/materials-catalog/import`.
- `project_materials`: материалы в рамках объекта (локальные либо привязанные к справочнику) + агрегаты для UI.
- `material_batches`: партии/поставки материалов на объект.
- `documents`: реестр документов качества (сертификаты/паспорта/протоколы и т.п.), scope: `project|global`.
- `document_bindings`: привязки документов к объекту/материалу/партии + флаги `useInActs`/`isPrimary`.
- `act_material_usages`: список материалов для п.3 АОСР "При выполнении работ применены…" (с порядком, опциональной привязкой к работе/партии/документу качества).
- `act_document_attachments`: формальные приложения к АОСР (уникально по (actId, documentId)), отдельно от `attachments`.
- `works`: позиции ВОР/ВОИР (код, описание, единицы, плановый объём, синонимы).
- `estimates`: шапка сметы/ЛСР (код, название, регион/квартал, итоги) — импортируется из Excel-выгрузки ГРАНД‑Сметы.
- `estimate_sections`: разделы сметы (номер/название) — опционально (если файл содержит "Раздел N...").
- `estimate_positions`: позиции сметы (№ п/п, обоснование/шифр, наименование, ед. изм., количество, суммы/примечания).
- `position_resources`: ресурсы внутри позиции сметы (код/тип, наименование, ед. изм., количество, суммы).
- `messages`: исходный текст, нормализованные поля (json), флаги обработки.
- `acts`: акты АОСР (глобальный номер `actNumber`, **тип акта** `actTemplateId`, период `dateStart/dateEnd`, статус, агрегированные работы `worksData` (json) + агрегированные поля документации из задач (`projectDrawingsAgg`, `normativeRefsAgg`, `executiveSchemesAgg`)).
- `attachments`: вложения к актам (url/name/type).
- `schedules`: графики работ (контейнеры диаграммы Ганта; в MVP обычно используется дефолтный).
- `schedule_tasks`: задачи графика (полосы Ганта), содержащие `startDate`/`durationDays`/`orderIndex`, номер акта `actNumber`, тип акта `actTemplateId` и поля документации/схем (`projectDrawings`, `normativeRefs`, `executiveSchemes`). 
  - **Функция Split Task**: поддержка разделения задач на последовательные захватки:
    - `split_group_id` (TEXT, nullable) — UUID, связывающий задачи-сиблинги, созданные разделением. `NULL` = задача не разделялась.
    - `split_index` (INTEGER, nullable) — порядковый номер в группе (0, 1, 2…). Используется для сортировки и отображения "1/3", "2/3".
    - `independent_materials` (BOOLEAN NOT NULL DEFAULT FALSE) — toggle-режим синхронизации материалов и документации:
      - `false` (по умолчанию) — добавление/удаление материалов и изменение документации (`projectDrawings`, `normativeRefs`, `executiveSchemes`) автоматически каскадирует на все задачи группы с тем же флагом `false`.
      - `true` — изменения затрагивают только текущую задачу, изолированный режим.
  - При разделении материалы/документация наследуются по выбору пользователя; каждая захватка получает свой `actNumber` и генерирует отдельный акт.
- `task_materials`: материалы, привязанные к задаче графика (источник для `act_material_usages` и `act_document_attachments` при генерации актов).
- `estimate_position_material_links`: привязка подстроки сметы (`estimate_positions`, вспомогательные строки) к материалу проекта (`project_materials`) для вычисления статуса документов качества в графике работ.
- `admin_users`: таблица администраторов системы (привязка `telegramUserId` и статус блокировки).

### Тарифная система

Система поддерживает три тарифа: **Базовый** (бесплатный), **Стандарт**, **Премиум**.

**Таблица users - новые поля:**
- `tariff` (TEXT NOT NULL DEFAULT 'basic') — текущий тариф пользователя
- `subscription_ends_at` (TIMESTAMP NULL) — дата окончания подписки
- `trial_used` (BOOLEAN NOT NULL DEFAULT false) — флаг использования Trial-периода

**Лимиты по тарифам:**
| Функция | Базовый | Стандарт | Премиум |
|---------|---------|----------|---------|
| Объекты строительства | 1 | 5 | безлимит |
| Split Task (захватки) | ❌ | ✅ | ✅ |
| Импорт PDF-счетов | ❌ | 20/мес | безлимит |
| Все остальное | ✅ | ✅ | ✅ |

**Trial-период:**
- 14 дней тарифа "Стандарт" для новых пользователей
- Автоматически активируется при регистрации
- Флаг `trial_used` предотвращает повторную активацию

**Архитектура:**
- **Реестр фич** (`shared/tariff-features.ts`) — единое место определения "что на каком тарифе"
- **Backend защита** — middleware `requireFeature()` проверяет доступ на API уровне (403 если нет доступа)
- **Frontend защита** — компонент `<TariffGuard>` скрывает/блокирует UI элементы
- **Эффективный тариф** — функция `getEffectiveTariff()` автоматически понижает до Basic при истечении подписки

Дополнительно (задел под AI-чат):
- `conversations` и chat-`messages` (см. `shared/schema.ts` + `server/replit_integrations/chat/*`).

## Контракт API (коротко)
Определён в `shared/routes.ts`, реализован в `server/routes.ts`.

Текущие ресурсы:
- **Auth** (новое):
  - `POST /api/auth/register` — регистрация по email/паролю (request: { email, password }, response: { user, token })
  - `POST /api/auth/login` — вход по email/паролю (request: { email, password }, response: { user, token })
  - `POST /api/auth/login/telegram` — вход через Telegram (request: { initData }, response: { user, token })
  - `GET /api/auth/me` — информация о текущем пользователе (требует JWT)
  - `POST /api/auth/link-provider` — привязка дополнительного провайдера к аккаунту (требует JWT)
  - **Примечание**: Все auth responses теперь включают поля: `tariff`, `subscriptionEndsAt`, `trialUsed`
- **Object (MVP current)**: `GET /api/object/current`, `PATCH /api/object/current`, `GET /api/object/current/source-data`, `PUT /api/object/current/source-data`
- **Materials Catalog**: `GET /api/materials-catalog`, `POST /api/materials-catalog`, `POST /api/admin/materials-catalog/import` (массовый импорт из Excel, только для администраторов)
- **Project Materials**: `GET /api/objects/:objectId/materials`, `POST /api/objects/:objectId/materials`, `GET /api/project-materials/:id`, `PATCH /api/project-materials/:id`, `POST /api/project-materials/:id/save-to-catalog`
- **Material Batches**: `POST /api/project-materials/:id/batches`, `PATCH /api/material-batches/:id`, `DELETE /api/material-batches/:id` (dev-only)
- **Invoice Import** (новые endpoints):
  - `POST /api/parse-invoice` — загрузка и парсинг PDF-счёта через invoice-extractor (multipart/form-data, rate-limited 10 req/min на пользователя)
  - `POST /api/bulk-create-materials` — массовое создание материалов проекта с дедупликацией по названию (case-insensitive)
- **Documents**: `GET /api/documents`, `POST /api/documents`
- **Document Bindings**: `POST /api/document-bindings`, `PATCH /api/document-bindings/:id`, `DELETE /api/document-bindings/:id`
- **Act material usages**: `GET /api/acts/:id/material-usages`, `PUT /api/acts/:id/material-usages`
- **Act document attachments**: `GET /api/acts/:id/document-attachments`, `PUT /api/acts/:id/document-attachments`
- **Works**: `GET /api/works`, `POST /api/works`
- **Estimates (Смета/ЛСР)**: `GET /api/estimates`, `GET /api/estimates/:id`, `POST /api/estimates/import`, `DELETE /api/estimates/:id` (опц. `?resetSchedule=1` — сбросить график/акты, если смета используется как источник графика)
- **Messages**: `GET /api/messages`, `POST /api/messages`, `PATCH /api/messages/:id`, `POST /api/messages/:id/process`
- **Voice**: `POST /api/voice/transcribe` — загрузка аудио (FormData, поле `audio`, до 10 MB), транскрипция через OpenAI Whisper, возврат `{ text }`. Rate limit: 10 req/min.
- **Acts**: `GET /api/acts`, `GET /api/acts/:id`, `POST /api/acts/:id/export`
  - `POST /api/acts/generate` и `POST /api/acts/create-with-templates` — **устарели** (410), создание актов только из графика работ
- **Act Templates**: `GET /api/act-templates`
- **Admin Panel** (только для администраторов):
  - **Users**: `GET /api/admin/users`, `POST /api/admin/users/:id/block|unblock|make-admin`, `DELETE /api/admin/users/:id/admin`, `GET /api/admin/admins`
  - **Stats**: `GET /api/admin/stats`
  - **Messages Queue**: `GET /api/admin/messages/failed`, `POST /api/admin/messages/:id/reprocess`
  - **Materials Catalog**: `POST /api/admin/materials-catalog/import`, `POST /api/admin/materials-catalog`, `PATCH /api/admin/materials-catalog/:id`, `DELETE /api/admin/materials-catalog/:id`
- **Admin Tariff Management** (новое):
  - `PATCH /api/admin/users/:id/tariff` — изменение тарифа пользователя (только для админов)
  - `GET /api/tariff/status` — информация о тарифе и квотах текущего пользователя
- **Schedules**: 
  - `GET /api/schedules/default`, `POST /api/schedules`, `GET /api/schedules/:id`
  - `POST /api/schedules/:id/bootstrap-from-works` — создать задачи из ВОР
  - `POST /api/schedules/:id/bootstrap-from-estimate` — создать задачи из позиций сметы
  - `POST /api/schedules/:id/generate-acts` — сформировать/обновить акты из графика
  - `GET /api/schedules/:id/estimate-subrows/statuses` — статусы документов качества для подстрок сметы (MVP)
  - `GET /api/schedules/:id/source-info` — информация об источнике графика
  - `POST /api/schedules/:id/change-source` — сменить источник графика (ВОР ↔ Смета)
- **Schedule Tasks**: 
  - `PATCH /api/schedule-tasks/:id` — обновление задачи (в т.ч. `actNumber`, `actTemplateId`, документация/схемы, `updateAllTasks`, `independentMaterials`)
  - **Split Task**: 
    - `POST /api/schedule-tasks/:id/split` — разделить задачу на 2+ последовательные захватки:
      - Request: `{ splitDate, quantityFirst, quantitySecond, newActNumber, inherit: { materials, projectDrawings, normativeRefs, executiveSchemes } }`
      - Response: `{ original: ScheduleTask, created: ScheduleTask }`
      - Валидация: `splitDate` должна быть строго внутри диапазона задачи; сумма объёмов должна соответствовать исходному
      - При множественном разделении: задачи одной группы связаны через `split_group_id`, нумерация через `split_index`
    - `GET /api/schedule-tasks/:id/split-siblings` — получить все задачи-захватки группы (упорядочены по `split_index`)
- **Task Materials**: `GET/PUT/POST/DELETE /api/schedule-tasks/:id/materials` — материалы задачи графика
- **Estimate subrow links (MVP)**:
  - `POST /api/estimate-position-links` — создать/обновить привязку подстроки сметы к материалу проекта
  - `DELETE /api/estimate-position-links/:estimatePositionId` — удалить привязку

Дополнительно:
- `POST /api/messages/:id/process` — принудительная повторная обработка (нормализация) сообщения по его `id` (реализовано в `server/routes.ts`).
- `POST /api/works/import` — bulk импорт ВОР, режим **merge** по умолчанию (без очистки существующих данных).
- `GET /api/pdfs/:filename` — выдача сгенерированных PDF из `generated_pdfs/`.

## Переменные окружения
- **DB**
  - `DATABASE_URL` — строка подключения к PostgreSQL (обязательна).
- **Authentication**
  - `JWT_SECRET` — секретный ключ для подписи JWT токенов (обязателен в production, минимум 32 символа).
  - `JWT_EXPIRES_IN` — время жизни JWT токена (опционально, по умолчанию: `7d`).
- **AI**
  - `AI_INTEGRATIONS_OPENAI_API_KEY`
  - `AI_INTEGRATIONS_OPENAI_BASE_URL`
- **Telegram**
  - `TELEGRAM_BOT_TOKEN` — токен бота для валидации initData (обязателен в production, опционален в dev).
- **Invoice Extractor**
  - `INVOICE_EXTRACTOR_URL` — URL микросервиса invoice-extractor (default: `http://localhost:5050`)
- **Server**
  - `PORT` — порт HTTP (по умолчанию 5000).
  - `ENABLE_DEMO_SEED=true` — (только dev) включить сидирование демо-работ в пустую БД. В production игнорируется.

## Команды разработки
См. `package.json`:
- `npm run dev` — запуск сервера в dev (Express + Vite middleware).
- `npm run build` — сборка в `dist/`.
- `npm run start` — запуск прод-сборки.
- `npm run check` — TypeScript проверки.
- `npm run db:migrate` — применение SQL-миграций из `migrations/` (**единственный допустимый способ изменения БД**).

**Не использовать:** `npm run db:push` — применение схемы Drizzle к БД. В проекте принят вариант B (SQL-миграции); `db:push` не синхронизирован с историей миграций и может привести к рассинхрону. См. `docs/db-migrations.md`.

## Миграции БД
Единственный допустимый процесс изменения БД: **SQL-миграции** (вариант B).

См. документ:
- `docs/db-migrations.md`

## Текущее состояние и ограничения (важно для планирования)
- Импорт Excel парсится на **клиенте**, но отправляется на сервер **одним bulk-запросом** (`POST /api/works/import`, `POST /api/admin/materials-catalog/import` и т.д.) без авто-очистки.
- Импорт PDF-счётов выполняется через микросервис invoice-extractor: клиент загружает файл через multer на `/api/parse-invoice`, обработка выполняется в отдельном процессе.
- AI-нормализация сообщений выполняется синхронно в обработчике `POST /api/messages` (с попыткой вернуть уже обновлённую запись).
- Контракт API и реализация должны оставаться синхронизированными (пример: `messages/:id/process`, `works/import`, `admin/materials-catalog/import`, `parse-invoice`).
- Импорт материалов использует **дедупликацию по названию** (case-insensitive) для безопасного merge-режима.

## Связанные документы
- `/docs/improvements.md` — перечень улучшений и расширений (приоритеты и идеи).
- `/docs/materials-import-guide.md` — подробное руководство по импорту материалов из Excel.
- `/docs/telegram-bot-setup.md` — пошаговая инструкция по созданию и настройке Telegram-бота.
- `/docs/telegram-buttons-guide.md` — руководство по использованию нативных кнопок Telegram (MainButton, BackButton).
- `/docs/telegram-haptic-guide.md` — руководство по использованию тактильной обратной связи (HapticFeedback).
