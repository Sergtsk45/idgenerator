# TelegramJurnalRabot — описание проекта

## Назначение
**TelegramJurnalRabot** — mobile-first веб-приложение (ориентировано на **Telegram MiniApp**) для автоматизации строительной документации, в частности формирования **АОСР** (Акты освидетельствования скрытых работ) на основе:
- ведомости объёмов работ (**ВОР/ВОИР**, Bill of Quantities / BoQ), импортируемой из Excel;
- журнала сообщений о выполненных работах (текстовые записи, потенциально — голосовые/расшифровки);
- нормализации сообщений с помощью AI (OpenAI) в структурированные данные;
- агрегации нормализованных записей в акты за выбранный период.

## Ключевые сценарии (как сейчас)
- **Импорт ВОР из Excel**: пользователь загружает `.xlsx`, клиент парсит файл и создаёт записи работ через API. (Есть временная отладочная логика: импорт может очищать существующие записи.)
- **Журнал работ**: пользователь отправляет сообщение о выполненной работе; сервер сохраняет raw-текст и пытается извлечь структуру через OpenAI (workCode/quantity/date/location и т.д.).
- **Генерация акта**: по диапазону дат выбираются обработанные сообщения, группируются по `workCode`, суммируются количества и создаётся запись акта.

## Архитектура (высокоуровневая)

### Компоненты
- **Frontend**: React + TypeScript, маршрутизация через Wouter, server-state через TanStack Query, локальное состояние (язык) через Zustand, UI на Tailwind + shadcn/ui, анимации Framer Motion.
- **Backend**: Express + TypeScript. REST API с типами/валидацией на базе `shared/routes.ts` (Zod).
- **База данных**: PostgreSQL + Drizzle ORM. Схема описана в `shared/schema.ts`.
- **AI**: OpenAI API (через переменные окружения интеграции), используется для нормализации сообщений.

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
  end
```

## Структура репозитория (важное)
- `client/` — фронтенд (Vite root)
  - `client/src/pages/*` — страницы: `Home` (журнал), `Works` (ВОР/ВОИР), `Acts` (акты), `Settings` (язык).
  - `client/src/components/*` — общие компоненты (включая нижнюю навигацию).
  - `client/src/hooks/*` — react-query хуки для API.
  - `client/src/lib/*` — queryClient, i18n, utils.
- `server/` — бэкенд (Express)
  - `server/index.ts` — входная точка, в dev подключает Vite middleware, в prod — статические файлы из `dist/public`.
  - `server/routes.ts` — регистрация API роутов для works/messages/acts.
  - `server/storage.ts` — слой доступа к данным (Drizzle).
  - `server/db.ts` — подключение к Postgres через `DATABASE_URL`.
  - `server/replit_integrations/*` — заготовки интеграций (чат, генерация изображений, batch-утилиты).
- `shared/` — общий код для frontend/backend
  - `shared/schema.ts` — Drizzle таблицы + Zod-схемы/типы.
  - `shared/routes.ts` — контракт API (пути, методы, схемы).

## Модель данных (текущее состояние)
Основные таблицы:
- `works`: позиции ВОР/ВОИР (код, описание, единицы, плановый объём, синонимы).
- `messages`: исходный текст, нормализованные поля (json), флаги обработки.
- `acts`: акты (период, локация, статус, агрегированные работы в json).
- `attachments`: вложения к актам (url/name/type).

Дополнительно (задел под AI-чат):
- `conversations` и chat-`messages` (см. `shared/schema.ts` + `server/replit_integrations/chat/*`).

## Контракт API (коротко)
Определён в `shared/routes.ts`, реализован в `server/routes.ts`.

Текущие ресурсы:
- **Works**: `GET /api/works`, `POST /api/works`
- **Messages**: `GET /api/messages`, `POST /api/messages`
- **Acts**: `GET /api/acts`, `POST /api/acts/generate`, `GET /api/acts/:id`

Примечание: в контракте есть `POST /api/messages/:id/process`, который требует сверки с реальной реализацией.

## Переменные окружения
- **DB**
  - `DATABASE_URL` — строка подключения к PostgreSQL (обязательна).
- **AI**
  - `AI_INTEGRATIONS_OPENAI_API_KEY`
  - `AI_INTEGRATIONS_OPENAI_BASE_URL`
- **Server**
  - `PORT` — порт HTTP (по умолчанию 5000).

## Команды разработки
См. `package.json`:
- `npm run dev` — запуск сервера в dev (Express + Vite middleware).
- `npm run build` — сборка в `dist/`.
- `npm run start` — запуск прод-сборки.
- `npm run check` — TypeScript проверки.
- `npm run db:push` — применение схемы Drizzle к БД.

## Текущее состояние и ограничения (важно для планирования)
- Импорт Excel выполняется на **клиенте** (парсинг `.xlsx` и последовательные `POST /api/works`).
- Есть временная логика очистки ВОР перед импортом (debug behavior).
- AI-нормализация сообщений выполняется синхронно в обработчике `POST /api/messages` (с попыткой вернуть уже обновлённую запись).
- Контракт API и реализация местами требуют синхронизации (пример: `messages/:id/process`).

## Связанный документ
- `/docs/improvements.md` — перечень улучшений и расширений (приоритеты и идеи).

