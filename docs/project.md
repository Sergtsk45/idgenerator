# TelegramJurnalRabot — описание проекта

## Назначение
**TelegramJurnalRabot** — mobile-first веб-приложение (ориентировано на **Telegram MiniApp**) для автоматизации строительной документации, в частности формирования **АОСР** (Акты освидетельствования скрытых работ) на основе:
- ведомости объёмов работ (**ВОР/ВОИР**, Bill of Quantities / BoQ), импортируемой из Excel;
- журнала сообщений о выполненных работах (текстовые записи, потенциально — голосовые/расшифровки);
- нормализации сообщений с помощью AI (OpenAI) в структурированные данные;
- агрегации нормализованных записей в акты за выбранный период.

## Ключевые сценарии (как сейчас)
- **Импорт ВОР из Excel**: пользователь загружает `.xlsx`, клиент парсит файл и отправляет позиции на сервер одним запросом `POST /api/works/import` в режиме **merge** (без авто-удаления данных).
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
    DB --> M[messages (raw + normalized)]
    DB --> A[acts (aggregated)]
    DB --> AT[attachments]
    DB --> S[schedules (gantt)]
    DB --> ST[schedule_tasks (gantt)]
    DB --> O[objects (construction objects)]
    DB --> OP[object_parties]
    DB --> ORP[object_responsible_persons]
  end
```

## Структура репозитория (важное)
- `client/` — фронтенд (Vite root)
  - `client/src/pages/*` — страницы: `Works` (ВОР/ВОИР), `Schedule` (график работ), `Home` (главная/чат-журнал), `Acts` (акты), `WorkLog` (ЖР/ОЖР), `Settings` (язык).
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

## Модель данных (текущее состояние)
Основные таблицы:
- `objects`: объект строительства (MVP: один «текущий объект»), используется как якорь для исходных данных плейсхолдеров.
- `object_parties`: стороны объекта (заказчик/подрядчик/проектировщик) с реквизитами (минимум — `fullName`).
- `object_responsible_persons`: ответственные лица/подписанты по ролям (ФИО/должность/основание + опционально line/sign).
- `works`: позиции ВОР/ВОИР (код, описание, единицы, плановый объём, синонимы).
- `messages`: исходный текст, нормализованные поля (json), флаги обработки.
- `acts`: акты (глобальный номер акта `actNumber`, период `dateStart/dateEnd`, локация, статус, агрегированные работы в `worksData` (json)) + `objectId` (FK → `objects.id`, может быть `NULL` для legacy).
- `attachments`: вложения к актам (url/name/type).
- `schedules`: графики работ (контейнеры диаграммы Ганта; в MVP обычно используется дефолтный).
- `schedule_tasks`: задачи графика (полосы Ганта), привязанные к `works` и содержащие `startDate`/`durationDays`/`orderIndex` и номер принадлежности к акту `actNumber`.

Дополнительно (задел под AI-чат):
- `conversations` и chat-`messages` (см. `shared/schema.ts` + `server/replit_integrations/chat/*`).

## Контракт API (коротко)
Определён в `shared/routes.ts`, реализован в `server/routes.ts`.

Текущие ресурсы:
- **Object (MVP current)**: `GET /api/object/current`, `PATCH /api/object/current`, `GET /api/object/current/source-data`, `PUT /api/object/current/source-data`
- **Works**: `GET /api/works`, `POST /api/works`
- **Messages**: `GET /api/messages`, `POST /api/messages`
- **Acts**: `GET /api/acts`, `POST /api/acts/generate` (legacy), `GET /api/acts/:id`, `POST /api/acts/create-with-templates` (legacy), `POST /api/acts/:id/export`
- **Act Templates**: `GET /api/act-templates`
- **Schedules**: `GET /api/schedules/default`, `POST /api/schedules`, `GET /api/schedules/:id`, `POST /api/schedules/:id/bootstrap-from-works`, `POST /api/schedules/:id/generate-acts`
- **Schedule Tasks**: `PATCH /api/schedule-tasks/:id`

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
- `npm run db:push` — применение схемы Drizzle к БД.

## Текущее состояние и ограничения (важно для планирования)
- Импорт Excel парсится на **клиенте**, но отправляется на сервер **одним bulk-запросом** `POST /api/works/import` (без авто-очистки).
- AI-нормализация сообщений выполняется синхронно в обработчике `POST /api/messages` (с попыткой вернуть уже обновлённую запись).
- Контракт API и реализация должны оставаться синхронизированными (пример: `messages/:id/process`, `works/import`).

## Связанный документ
- `/docs/improvements.md` — перечень улучшений и расширений (приоритеты и идеи).