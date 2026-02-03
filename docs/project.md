# TelegramJurnalRabot — описание проекта

## Назначение
**TelegramJurnalRabot** — mobile-first веб-приложение (ориентировано на **Telegram MiniApp**) для автоматизации строительной документации, в частности формирования **АОСР** (Акты освидетельствования скрытых работ) на основе:
- ведомости объёмов работ (**ВОР/ВОИР**, Bill of Quantities / BoQ), импортируемой из Excel;
- журнала сообщений о выполненных работах (текстовые записи, потенциально — голосовые/расшифровки);
- нормализации сообщений с помощью AI (OpenAI) в структурированные данные;
- агрегации нормализованных записей в акты за выбранный период.

## Ключевые сценарии (как сейчас)
- **Импорт ВОР из Excel**: пользователь загружает `.xlsx`, клиент парсит файл и отправляет позиции на сервер одним запросом `POST /api/works/import` в режиме **merge** (без авто-удаления данных).
- **Импорт Сметы/ЛСР из Excel (ГРАНД‑Смета)**: на экране `/works` пользователь переключается в режим “Смета”, загружает `.xlsx`; клиент парсит выгрузку (поиск строки заголовка `№ п/п / Обоснование / Наименование работ и затрат`, разбор позиций/ресурсов) и отправляет JSON на `POST /api/estimates/import`. Смета хранится отдельными таблицами и отображается на вкладке ВОР.
- **Журнал работ**: пользователь отправляет сообщение о выполненной работе; сервер сохраняет raw-текст и пытается извлечь структуру через OpenAI (workCode/quantity/date/location и т.д.).
- **Генерация акта (legacy)**: по диапазону дат выбираются обработанные сообщения, группируются по `workCode`, суммируются количества и создаётся запись акта.
- **Генерация актов из графика работ (новое)**: на экране `/schedule` каждой задаче задаётся номер принадлежности `actNumber`. По кнопке “Сформировать/обновить акты из графика” сервер группирует задачи по `actNumber`, вычисляет `dateStart/dateEnd` и формирует `worksData` (агрегация по `workId`, quantity — из `works.quantityTotal`).
- **Экспорт PDF АОСР**: `POST /api/acts/:id/export` генерирует один или несколько PDF по выбранным шаблонам. Для АОСР используется pdfmake-шаблон `server/templates/aosr/aosr-template.json` с плейсхолдерами `{{...}}` (в эталонном варианте под `005_АОСР 4.pdf` материалы и приложения формируются **текстом**, а не таблицей; данные приходят через `formData`).

## Архитектура (высокоуровневая)

### Компоненты
- **Frontend**: React + TypeScript, маршрутизация через Wouter, server-state через TanStack Query, локальное состояние (язык) через Zustand, UI на Tailwind + shadcn/ui, анимации Framer Motion.
- **Backend**: Express + TypeScript. REST API с типами/валидацией на базе `shared/routes.ts` (Zod).
- **База данных**: PostgreSQL + Drizzle ORM. Схема описана в `shared/schema.ts`.
- **AI**: OpenAI API (через переменные окружения интеграции), используется для нормализации сообщений.
- **Навигация UI**: основные разделы в `BottomNav`, доступ к `Settings` — через выпадающее меню “гамбургера” в `Header`.
  - Порядок вкладок `BottomNav` (слева направо): **ВОР → График работ → Акты → ЖР → Исходные**
  - **Главная** (`/`) вынесена в кнопку в правом верхнем углу `Header` (иконка микрофона).

### Диаграмма взаимодействий
```mermaid
flowchart LR
  UI[React MiniApp UI] -->|REST| API[Express API]
  API --> DB[(PostgreSQL)]
  API -->|OpenAI Chat Completions| AI[OpenAI]

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
    DB --> ST[schedule_tasks (gantt)]
    DB --> EPML[estimate_position_material_links]
    DB --> O[objects (construction objects)]
    DB --> OP[object_parties]
    DB --> ORP[object_responsible_persons]
  end
```

## Структура репозитория (важное)
- `client/` — фронтенд (Vite root)
  - `client/src/pages/*` — страницы: `Works` (ВОР/ВОИР), `Schedule` (график работ), `Home` (главная/чат-журнал), `Acts` (акты), `WorkLog` (ЖР/ОЖР), `Settings` (язык), `SourceData` (исходные), `SourceMaterials`/`SourceMaterialDetail` (материалы), `SourceDocuments` (документы качества).
    - `SourceData` (`/source-data`) — “дашборд” исходных данных: sticky-текущий объект + адрес, горизонтальные карточки сторон и карточки-разделы (материалы/документы/исполнительные/протоколы) + блок реквизитов/ответственных для редактирования.
  - `client/src/components/*` — общие компоненты (включая нижнюю навигацию).
  - `client/src/hooks/*` — react-query хуки для API.
  - `client/src/lib/*` — queryClient, i18n, utils.
- `server/` — бэкенд (Express)
  - `server/index.ts` — входная точка, в dev подключает Vite middleware, в prod — статические файлы из `dist/public`.
  - `server/routes.ts` — регистрация API роутов для works/messages/acts.
  - `server/storage.ts` — слой доступа к данным (Drizzle).
  - `server/db.ts` — подключение к Postgres через `DATABASE_URL`.
  - `server/pdfGenerator.ts` — генерация PDF (pdfmake), включая АОСР по шаблону `server/templates/aosr/aosr-template.json`.
  - `server/templates/aosr/` — шаблоны и каталог шаблонов актов (`aosr-template.json`, `templates-catalog.json`).
  - `server/replit_integrations/*` — заготовки интеграций (чат, генерация изображений, batch-утилиты).
- `shared/` — общий код для frontend/backend
  - `shared/schema.ts` — Drizzle таблицы + Zod-схемы/типы.
  - `shared/routes.ts` — контракт API (пути, методы, схемы).
- `attached_assets/GESN/` — утилита для парсинга справочников ГЭСН (PDF → SQLite) на Python.
  - Скрипт: `attached_assets/GESN/gesn_pdf_to_sqlite.py`
  - Результат: SQLite-файл (`--db`) и лог (`--log`). При относительном пути файлы сохраняются рядом со скриптом (в `attached_assets/GESN/`).

## Модель данных (текущее состояние)
Основные таблицы:
- `objects`: объект строительства (MVP: один «текущий объект»), используется как якорь для исходных данных плейсхолдеров.
- `object_parties`: стороны объекта (заказчик/подрядчик/проектировщик) с реквизитами (минимум — `fullName`, дополнительно — ИНН/КПП/ОГРН, юр.адрес, телефон, email, реквизиты СРО). Эти данные используются при экспорте АОСР в PDF (если не переопределены через `formData`).
- `object_responsible_persons`: ответственные лица/подписанты по ролям (ФИО/должность/основание + опционально line/sign).
- `materials_catalog`: глобальный справочник материалов (наименование, ГОСТ/ТУ, ед. изм., параметры).
- `project_materials`: материалы в рамках объекта (локальные либо привязанные к справочнику) + агрегаты для UI.
- `material_batches`: партии/поставки материалов на объект.
- `documents`: реестр документов качества (сертификаты/паспорта/протоколы и т.п.), scope: `project|global`.
- `document_bindings`: привязки документов к объекту/материалу/партии + флаги `useInActs`/`isPrimary`.
- `act_material_usages`: список материалов для п.3 АОСР “При выполнении работ применены…” (с порядком, опциональной привязкой к работе/партии/документу качества).
- `act_document_attachments`: формальные приложения к АОСР (уникально по (actId, documentId)), отдельно от `attachments`.
- `works`: позиции ВОР/ВОИР (код, описание, единицы, плановый объём, синонимы).
- `estimates`: шапка сметы/ЛСР (код, название, регион/квартал, итоги) — импортируется из Excel-выгрузки ГРАНД‑Сметы.
- `estimate_sections`: разделы сметы (номер/название) — опционально (если файл содержит “Раздел N...”).
- `estimate_positions`: позиции сметы (№ п/п, обоснование/шифр, наименование, ед. изм., количество, суммы/примечания).
- `position_resources`: ресурсы внутри позиции сметы (код/тип, наименование, ед. изм., количество, суммы).
- `messages`: исходный текст, нормализованные поля (json), флаги обработки.
- `acts`: акты (глобальный номер акта `actNumber`, период `dateStart/dateEnd`, локация, статус, агрегированные работы в `worksData` (json)) + `objectId` (FK → `objects.id`, может быть `NULL` для legacy).
- `attachments`: вложения к актам (url/name/type).
- `schedules`: графики работ (контейнеры диаграммы Ганта; в MVP обычно используется дефолтный).
- `schedule_tasks`: задачи графика (полосы Ганта), привязанные к `works` и содержащие `startDate`/`durationDays`/`orderIndex` и номер принадлежности к акту `actNumber`.
- `estimate_position_material_links`: привязка подстроки сметы (`estimate_positions`, вспомогательные строки) к материалу проекта (`project_materials`) для вычисления статуса документов качества в графике работ.

Дополнительно (задел под AI-чат):
- `conversations` и chat-`messages` (см. `shared/schema.ts` + `server/replit_integrations/chat/*`).

## Контракт API (коротко)
Определён в `shared/routes.ts`, реализован в `server/routes.ts`.

Текущие ресурсы:
- **Object (MVP current)**: `GET /api/object/current`, `PATCH /api/object/current`, `GET /api/object/current/source-data`, `PUT /api/object/current/source-data`
- **Materials Catalog**: `GET /api/materials-catalog`, `POST /api/materials-catalog`
- **Project Materials**: `GET /api/objects/:objectId/materials`, `POST /api/objects/:objectId/materials`, `GET /api/project-materials/:id`, `PATCH /api/project-materials/:id`, `POST /api/project-materials/:id/save-to-catalog`
- **Material Batches**: `POST /api/project-materials/:id/batches`, `PATCH /api/material-batches/:id`, `DELETE /api/material-batches/:id` (dev-only)
- **Documents**: `GET /api/documents`, `POST /api/documents`
- **Document Bindings**: `POST /api/document-bindings`, `PATCH /api/document-bindings/:id`, `DELETE /api/document-bindings/:id`
- **Act material usages**: `GET /api/acts/:id/material-usages`, `PUT /api/acts/:id/material-usages`
- **Act document attachments**: `GET /api/acts/:id/document-attachments`, `PUT /api/acts/:id/document-attachments`
- **Works**: `GET /api/works`, `POST /api/works`
- **Estimates (Смета/ЛСР)**: `GET /api/estimates`, `GET /api/estimates/:id`, `POST /api/estimates/import`, `DELETE /api/estimates/:id` (опц. `?resetSchedule=1` — сбросить график/акты, если смета используется как источник графика)
- **Messages**: `GET /api/messages`, `POST /api/messages`
- **Acts**: `GET /api/acts`, `POST /api/acts/generate` (legacy), `GET /api/acts/:id`, `POST /api/acts/create-with-templates` (legacy), `POST /api/acts/:id/export`
- **Act Templates**: `GET /api/act-templates`
- **Schedules**: 
  - `GET /api/schedules/default`, `POST /api/schedules`, `GET /api/schedules/:id`
  - `POST /api/schedules/:id/bootstrap-from-works` — создать задачи из ВОР
  - `POST /api/schedules/:id/bootstrap-from-estimate` — создать задачи из позиций сметы
  - `POST /api/schedules/:id/generate-acts` — сформировать/обновить акты из графика
  - `GET /api/schedules/:id/estimate-subrows/statuses` — статусы документов качества для подстрок сметы (MVP)
  - `GET /api/schedules/:id/source-info` — информация об источнике графика
  - `POST /api/schedules/:id/change-source` — сменить источник графика (ВОР ↔ Смета)
- **Schedule Tasks**: `PATCH /api/schedule-tasks/:id`
- **Estimate subrow links (MVP)**:
  - `POST /api/estimate-position-links` — создать/обновить привязку подстроки сметы к материалу проекта
  - `DELETE /api/estimate-position-links/:estimatePositionId` — удалить привязку

Дополнительно:
- `POST /api/messages/:id/process` — принудительная повторная обработка (нормализация) сообщения по его `id` (реализовано в `server/routes.ts`).
- `POST /api/works/import` — bulk импорт ВОР, режим **merge** по умолчанию (без очистки существующих данных).
- `GET /api/pdfs/:filename` — выдача сгенерированных PDF из `generated_pdfs/`.

Примечание по безопасности:
- `DELETE /api/works` — **деструктивный debug-эндпоинт**. В production отключён (возвращает 404).

## Переменные окружения
- **DB**
  - `DATABASE_URL` — строка подключения к PostgreSQL (обязательна).
- **AI**
  - `AI_INTEGRATIONS_OPENAI_API_KEY`
  - `AI_INTEGRATIONS_OPENAI_BASE_URL`
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
- Импорт Excel парсится на **клиенте**, но отправляется на сервер **одним bulk-запросом** `POST /api/works/import` (без авто-очистки).
- AI-нормализация сообщений выполняется синхронно в обработчике `POST /api/messages` (с попыткой вернуть уже обновлённую запись).
- Контракт API и реализация должны оставаться синхронизированными (пример: `messages/:id/process`, `works/import`).

## Связанный документ
- `/docs/improvements.md` — перечень улучшений и расширений (приоритеты и идеи).