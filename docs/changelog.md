# Changelog

## [2026-03-06] - Внедрение тарифной системы

### Добавлено
- **Тарифная система** с тремя уровнями: Базовый (бесплатный), Стандарт, Премиум
- **Лимиты по тарифам:**
  - Объекты строительства: 1 / 5 / безлимит
  - Импорт PDF-счетов: 0 / 20/мес / безлимит
  - Split Task (захватки): недоступен / доступен / доступен
- **Trial-период:** 14 дней тарифа "Стандарт" для новых пользователей
- **Защита функций:**
  - Backend: middleware `requireFeature()` возвращает 403 при отсутствии доступа
  - Frontend: компонент `<TariffGuard>` скрывает/блокирует UI элементы
- **Админ-панель:** управление тарифами пользователей (изменение тарифа, активация Trial)
- **API endpoints:**
  - `PATCH /api/admin/users/:id/tariff` — управление тарифами (только для админов)
  - `GET /api/tariff/status` — информация о тарифе и квотах
- **Реестр фич** (`shared/tariff-features.ts`) — единое место определения ограничений

### Изменено
- **База данных:** добавлены поля в таблицу `users`:
  - `tariff` (TEXT NOT NULL DEFAULT 'basic')
  - `subscription_ends_at` (TIMESTAMP NULL)
  - `trial_used` (BOOLEAN NOT NULL DEFAULT false)
- **Auth responses:** все эндпоинты аутентификации теперь возвращают `tariff`, `subscriptionEndsAt`, `trialUsed`
- **UI:** кнопки Split Task и Invoice Import защищены `<TariffGuard>`

### Технические детали
- SQL-миграция: `migrations/0021_user_tariff.sql`
- Автоматический downgrade на Basic при истечении подписки (через `getEffectiveTariff()`)
- Глобальная обработка ошибки 403 TARIFF_REQUIRED в queryClient
- Защита на трех уровнях: база данных → backend → frontend

## [2026-03-05] - Исправление генерации актов из графика

### Исправлено
- **Страница «Акты (АОСР)»**: кнопка «Сформировать/обновить из графика» вызывала `fetch` без заголовков аутентификации, из‑за чего сервер возвращал 401 и показывалась ошибка «Failed to generate acts from schedule». Запрос переведён на `apiRequest`, который добавляет JWT или `X-Telegram-Init-Data`.

## [2026-03-02] - Разделение задач графика (Split Task) — Завершена полная реализация (Этапы 1-9)

### Добавлено
- **Функция разделения задач (Split Task)**: пользователь может разделить задачу графика на 2+ последовательные задачи-захватки ("захватки") с независимыми сроками и номерами актов. Поддерживается множественное разделение — уже разделённая задача может быть разделена снова (N захваток).
  - **Модель данных** (`schedule_tasks`):
    - `split_group_id` (TEXT, nullable) — UUID, связывающий задачи-сиблинги, созданные разделением
    - `split_index` (INTEGER, nullable) — порядковый номер в группе (0, 1, 2…) для сортировки и отображения "1/3", "2/3"
    - `independent_materials` (BOOLEAN NOT NULL DEFAULT FALSE) — toggle-режим синхронизации материалов и документации
    - Индекс на `split_group_id` для оптимизации запросов сиблингов
  - **API endpoints**:
    - `POST /api/schedule-tasks/:id/split` — разделить задачу:
      - Request: `splitDate` (дата границы), `quantityFirst`/`quantitySecond` (распределение объёма), `newActNumber` (номер акта для второй части), `inherit` (флаги наследования: materials, projectDrawings, normativeRefs, executiveSchemes)
      - Response: `{ original: ScheduleTask, created: ScheduleTask }`
      - Валидация: `splitDate` строго внутри диапазона задачи, сумма объёмов соответствует исходному
      - Транзакционная безопасность: обновление исходной задачи, сдвиг `orderIndex`, вставка новой, копирование материалов
    - `GET /api/schedule-tasks/:id/split-siblings` — получить все задачи группы (упорядочены по `split_index`)
  - **UI компоненты**:
    - Диалог `SplitTaskDialog.tsx`: выбор даты разделения, распределение объёма (с авто-расчётом остатка), номер акта для второй части, чекбоксы наследования (материалы, документация, схемы)
    - Кнопка "Разделить" в списке задач графика (иконка ножницы)
    - Badge "X из Y" для отображения позиции захватки в группе
    - Визуальная связь на Ганте: одинаковый цвет полос для группы, пунктирные линии-коннекторы, подсветка при наведении
  - **Toggle "Независимые материалы"** (`independentMaterials`):
    - Отображается только для задач с `split_group_id IS NOT NULL`
    - **Выкл** (`false`, по умолчанию): добавление/удаление материалов и изменение документации (`projectDrawings`, `normativeRefs`, `executiveSchemes`) автоматически каскадирует на все задачи группы с флагом `false`. Режим "общие материалы на все захватки".
    - **Вкл** (`true`): изменения затрагивают только текущую задачу. Изолированный режим "свои материалы для захватки".
    - Информативные подсказки: "Материалы синхронизируются с N захваткам(и)" или "Материалы только для этой захватки"
  - **Наследование при разделении**: пользователь выбирает через чекбоксы, какие данные копировать во вторую часть (материалы, проектная документация, нормативные ссылки, исполнительные схемы)
  - **Генерация актов**: без изменений в логике — каждая захватка имеет свой `actNumber` → группируется в свой акт со своими сроками (`dateStart`/`dateEnd`) и материалами

### Изменено
- **Backend** (`server/storage.ts`, `server/routes.ts`):
  - Метод `splitScheduleTask(taskId, params)`: транзакционное разделение с валидацией, сдвигом `orderIndex`, копированием материалов, обработкой множественного split (сохранение `split_group_id`, инкремент `split_index`)
  - Метод `syncMaterialsAcrossSplitGroup(taskId, ...)`: каскадирование добавления материалов на сиблингов с `independentMaterials = false`
  - Метод `syncMaterialDeleteAcrossSplitGroup(taskId, materialId)`: каскадирование удаления материалов
  - Метод `syncDocsAcrossSplitGroup(taskId, docFields)`: синхронизация `projectDrawings`, `normativeRefs`, `executiveSchemes` при PATCH задачи
  - Обновлён `PATCH /api/schedule-tasks/:id`: поддержка `independentMaterials` + автоматический вызов sync-методов при изменении документации
  - Обновлён `POST/DELETE /api/schedule-tasks/:id/materials`: автоматический вызов sync-методов после добавления/удаления материалов (если `independentMaterials = false`)
- **Frontend** (`client/src/pages/Schedule.tsx`, `client/src/hooks/use-schedules.ts`):
  - Хуки `useSplitScheduleTask()`, `useSplitSiblings()` для работы с API
  - Toggle "Независимые материалы и документация" в диалоге редактирования задачи (видимость зависит от `splitGroupId != null`)
  - Индикаторы режима в `TaskMaterialsEditor` и секциях документации
  - Визуальная связь на Ганте: генерация цвета из hash `splitGroupId`, пунктирные коннекторы, подсветка сиблингов при hover
- **Схемы и контракты**:
  - `shared/schema.ts`: добавлены колонки `splitGroupId`, `splitIndex`, `independentMaterials` в `scheduleTasks`
  - `shared/routes.ts`: добавлены контракты `scheduleTasks.split` и `scheduleTasks.splitSiblings`, расширен `scheduleTasks.patch`
- **Документация**:
  - `docs/project.md`:
    - Раздел "Модель данных": подробное описание `split_group_id`, `split_index`, `independent_materials` с семантикой и примерами
    - Раздел "Контракт API": добавлены endpoints `/split` и `/split-siblings` с описанием request/response и валидации
    - Раздел "Ключевые сценарии": развёрнутое описание процесса разделения, toggle-режима, наследования, генерации актов
  - `docs/changelog.md`: запись о новой функциональности с подробностями реализации
  - `docs/tasktracker3-split-task.md`: детальный план реализации (Этапы 1-9) с техническими спецификациями, алгоритмами, edge cases, критериями приёмки

### Миграции
- `migrations/0020_add_split_fields.sql` — добавление колонок `split_group_id`, `split_index`, `independent_materials` в таблицу `schedule_tasks` + индекс на `split_group_id`

### Исправлено
- Нет (новая функциональность)

### Тестирование
- Проверены сценарии: базовое разделение, множественное разделение (N захваток), наследование материалов, синхронизация материалов (toggle OFF/ON), удаление материалов, синхронизация документации, переключение toggle, генерация актов для захваток, корректность `orderIndex`, конфликт `actNumber`
- Edge cases: разделение 1-дневной задачи (запрещено), нулевой объём (минимум 0.0001), `splitDate` вне диапазона (400)

---

## [2026-03-01] - Мультипровайдерная аутентификация (завершена, MULTI-001 до MULTI-030)

### Добавлено
- **Таблицы users и auth_providers**: мультипровайдерный реестр пользователей
  - `users` (id, email, password_hash, role, isBlocked, created_at, updated_at)
  - `auth_providers` (user_id, provider, provider_user_id, linked_at)
- **JWT-токены (HS256)** для аутентификации всех пользователей
  - Срок жизни: 7 дней (настраивается через `JWT_EXPIRES_IN`)
  - Хранение: localStorage на клиенте
  - Отправка: автоматически в заголовке `Authorization: Bearer <token>`
- **Auth-сервис** (`server/auth-service.ts`):
  - Хеширование паролей через bcrypt (rounds=12)
  - Генерация/верификация JWT токенов (jose, HS256)
  - Унифицированный интерфейс для работы с провайдерами
  - Валидация Telegram auth_date (< 600 сек, protection от replay)
- **Unified auth middleware** (`server/middleware/auth.ts`):
  - Поддержка JWT (`Authorization: Bearer`)
  - Поддержка Telegram initData (`X-Telegram-Init-Data`)
  - Legacy browser token (`X-App-Access-Token`) для обратной совместимости
- **API endpoints** (`server/routes/auth.ts`):
  - `POST /api/auth/register` — регистрация по email/паролю
  - `POST /api/auth/login` — вход по email/паролю
  - `POST /api/auth/login/telegram` — вход через Telegram (сохранение JWT)
  - `GET /api/auth/me` — информация о текущем пользователе
  - `POST /api/auth/link-provider` — привязка дополнительного провайдера
- **Rate limiting** на auth endpoints:
  - `/login` и `/login/telegram` — 5 попыток в минуту на IP
  - `/register` — 3 попытки в час на IP
- **Клиентская поддержка**:
  - `client/src/lib/auth.ts` — утилиты для работы с JWT
  - `client/src/hooks/use-auth.ts` — React Query хуки
  - `client/src/components/AuthGuard.tsx` — компонент защиты маршрутов
  - `client/src/pages/Login.tsx` — обновлена поддержка JWT
  - `client/src/pages/Register.tsx` — регистрация по email/паролю
- **Автоматическая миграция** существующих пользователей Telegram

### Изменено
- Все API endpoints теперь используют внутренний `users.id` вместо `telegram_user_id`
- Роль администратора теперь в `users.role` вместо отдельной таблицы `admin_users`
- `messages.userId` теперь integer (ссылка на `users.id`) вместо text
- `objects.user_id` теперь ссылка на `users.id` вместо `objects.telegram_user_id`
- Клиент автоматически использует JWT для аутентификации во всех запросах
- Middleware `telegramAuth.ts` интегрирована с новым auth-сервисом

### Удалено
- Таблица `admin_users` (заменена на `users.role`)
- Колонка `objects.telegram_user_id` (заменена на `objects.user_id`)
- Dev-only токен `APP_ACCESS_TOKEN` из основного flow (заменён на JWT)
- Middleware `browserTokenAuth.ts` (заменён на unified `auth.ts`)

### Безопасность
- Пароли хешируются через bcrypt (cost factor 12)
- JWT секрет обязателен в production (`JWT_SECRET` env, >= 32 символа)
- Telegram auth_date валидация (< 600 сек) защищает от replay атак
- Rate limiting против brute force атак на login/register
- Поддержка блокировки пользователей (`users.isBlocked`)

### Миграции
- `0018_users_auth_providers.sql` — создание таблиц users и auth_providers, автоматическая миграция данных из telegram_user_id
- `0019_drop_legacy_telegram_columns.sql` — удаление legacy таблиц и колонок

### Документация
- `docs/auth-guide.md` — полное руководство по аутентификации (провайдеры, JWT, безопасность, миграция, troubleshooting)
- `docs/project.md` — обновлен раздел аутентификации, диаграмма компонентов, переменные окружения, контракт API

### Переменные окружения
- `JWT_SECRET` — обязательна в production (минимум 32 символа)
- `JWT_EXPIRES_IN` — опциональна, default: `7d`

### Зависимости
- `bcryptjs` — хеширование паролей
- `jose` — работа с JWT токенами
- `express-rate-limit` — rate limiting на auth endpoints

---

## [2026-03-01] - Импорт материалов из PDF-счетов поставщиков (фаза 1-3 завершены, INV-001 до INV-009)

### Добавлено
- **Микросервис `services/invoice-extractor/`** (Python/Flask): парсинг PDF-счетов поставщиков, извлечение таблиц материалов
- **Docker Compose сервис invoice-extractor**: запуск на порту `5050:5000` с healthcheck
- **Backend API endpoints**:
  - `POST /api/parse-invoice` — proxy к invoice-extractor с поддержкой multer (загрузка PDF), FormData, SSRF-защита
  - `POST /api/bulk-create-materials` — массовое создание материалов проекта с case-insensitive дедупликацией
- **Frontend React Query хуки** в `client/src/hooks/use-materials.ts`:
  - `useParseInvoice()` — парсинг загруженного счёта
  - `useBulkCreateMaterials()` — создание множества материалов в проекте
- **UI компоненты**:
  - `InvoiceImportButton.tsx` — кнопка импорта на вкладке "Локальные" материалов
  - `InvoicePreviewDialog.tsx` — диалог предпросмотра со строкой заголовка, чекбоксами, inline-редактированием, итоговым отчётом
- **Новая переменная окружения** `INVOICE_EXTRACTOR_URL` (default: `http://localhost:5050`)

### Изменено
- `shared/routes.ts`: добавлены Zod-схемы `parseInvoiceRequest`, `parseInvoiceResponse`, `bulkCreateMaterialsRequest`, `bulkCreateMaterialsResponse`
- `server/storage.ts`: метод `bulkCreateProjectMaterials()` с case-insensitive дедупликацией и транзакционной обработкой
- `server/routes.ts`: добавлены эндпоинты `/parse-invoice` и `/bulk-create-materials` с обработкой ошибок и SSRF-защитой
- `client/src/pages/SourceMaterials.tsx`: интеграция кнопки импорта счетов на вкладке "Локальные"

### Исправлено
- Multer error handling для некорректных мультичастных запросов
- SSRF-валидация при обращении к invoice-extractor (проверка URL и выхода)
- Утечка памяти: очистка временных файлов после обработки
- Rate limiting на endpoint `/parse-invoice` (10 запросов в минуту на пользователя)

### Технические детали
- **Зависимости**: `multer` (загрузка PDF), `express-rate-limit` (rate limiting)
- **Безопасность**: SSRF-защита, валидация ContentType, максимальный размер файла 10MB
- **Производительность**: асинхронная обработка, очистка временных файлов после завершения
- **Резилиентность**: retry-логика для обращений к invoice-extractor при сетевых ошибках

---

## [2026-03-01] - Инфраструктура микросервиса invoice-extractor (INV-001, INV-002)
### Добавлено
- **Микросервис `services/invoice-extractor/`**: реструктуризация сервиса парсинга PDF-счетов в отдельный пакет с правильной структурой Python-пакета `app/`
- **`services/invoice-extractor/app/`**: Python-пакет с модулями `extractor`, `llm_client`, `normalizer`, `validators`, `excel_builder`
- **`services/invoice-extractor/Dockerfile`**: обновлённый Dockerfile с добавлением `curl` для healthcheck
- **`services/invoice-extractor/.dockerignore`**: исключение `__pycache__`, `.env`, `uploads/`, `outputs/`
- **`docker-compose.yml`**: конфигурация для запуска invoice-extractor на порту `5050:5000` с healthcheck
- **`INVOICE_EXTRACTOR_URL`**: переменная окружения добавлена в `.env` (default: `http://localhost:5050`)

## [2026-02-26] - Массовый импорт материалов из Excel
### Добавлено
- **Импорт материалов из Excel**: администраторы могут загружать справочник материалов из Excel-файла (.xlsx/.xls) в глобальный каталог
- **Backend API**: `POST /api/admin/materials-catalog/import` — endpoint для массового импорта с поддержкой режимов merge/replace
- **Парсер Excel**: `client/src/lib/materialsParser.ts` — клиентский парсинг Excel с валидацией формата, размера и структуры данных
- **UI импорта**: кнопка "Импорт" в админ-панели материалов с обработкой файлов и отображением результатов
- **Транзакционная обработка**: весь импорт выполняется в одной DB-транзакции с rollback при ошибках
- **Case-insensitive дедупликация**: материалы сравниваются по названию без учёта регистра
- **Статистика импорта**: детальный отчёт о количестве полученных, созданных, обновлённых и пропущенных записей
- **Валидация данных**: проверка обязательных полей, длины названия (≤500 символов), формата файла и размера (≤10 МБ)

### Изменено
- `shared/routes.ts`: добавлены типы и Zod-схемы для импорта материалов (ImportMaterialItem, ImportMaterialsRequest, ImportMaterialsResponse)
- `server/storage.ts`: метод `importMaterialsCatalog()` для массового создания/обновления материалов
- `server/routes.ts`: endpoint импорта с admin-авторизацией и обработкой ошибок
- `client/src/hooks/use-admin.ts`: хук `useAdminImportMaterials()` с инвалидацией кэша
- `client/src/pages/admin/AdminMaterials.tsx`: UI кнопки импорта с file input и toast-уведомлениями

### Документация
- `docs/materials-import-guide.md`: полное руководство по импорту материалов с примерами и best practices

---

## [2026-02-26] - Исправлена авторизация запросов useCurrentObject
### Исправлено
- `client/src/hooks/use-source-data.ts`: хуки `useCurrentObject`, `useSourceData`, `useSaveSourceData` теперь передают заголовки авторизации (`X-Telegram-Init-Data` / `X-App-Access-Token`). Ранее их отсутствие приводило к 401 от `GET /api/object/current`, из-за чего `objectId` не определялся и при добавлении материала появлялся тост «Нет объекта».

---

## [2026-02-26] - График: диалог разрешения конфликтов типа акта
### Добавлено
- При конфликте типа акта (409) — диалог с выбором: применить тип из акта к задаче или изменить тип для всех задач акта.
- `conflictKind`: actNumberAssign, actNumberChange, templateChange.
- Выбор шаблона акта через `sessionStorage.selectedActTemplateId` вместо `history.state`.

### Изменено
- `server/routes.ts`: 409 с полями actNumber, currentTemplateId, conflictKind; логика BLOCK A/B.
- `Schedule.tsx`: updateAllTasks по умолчанию undefined; обработка 409 и handleActConflictAccept.

---

## [2026-02-26] - Материалы: понятные empty-state при добавлении
### Исправлено
- `client/src/pages/SelectTaskMaterials.tsx`: диалог «Добавить материал» теперь показывает явные состояния:
  - если в проекте нет материалов — текст «Сначала добавьте материалы в проект» + кнопка перехода на `/source/materials`
  - если все материалы проекта уже добавлены в задачу — текст «Все материалы уже добавлены в задачу»
- `client/src/pages/SourceMaterials.tsx`: кнопка «Добавить материал» больше не “молчит”, если текущий объект ещё не загрузился — показывается toast с причиной.

## [2026-02-25] - Telegram MiniApp: исправлена отправка сообщений в production
### Исправлено
- `client/src/hooks/use-messages.ts`: все запросы к `/api/messages` теперь отправляют `X-Telegram-Init-Data` (нужно для `telegramAuth` в production); улучшено извлечение текста ошибки из ответа API (`message`/`error`/text).
- `client/src/pages/Home.tsx`: при ошибке отправки в toast показывается деталь ошибки (если сервер вернул причину).
- `server/routes.ts`: при сбое AI-нормализации сообщения больше не зависают в статусе “обрабатывается” — сообщение помечается обработанным без `normalizedData`.

### Добавлено
- Доступ к приложению в обычном браузере на production через access-token:
  - `server/middleware/browserTokenAuth.ts`: заголовок `X-App-Access-Token` (значение сравнивается с `APP_ACCESS_TOKEN`).
  - `client/src/pages/Login.tsx`, роут `/login`: экран ввода токена, сохранение в localStorage.
  - `client/src/lib/queryClient.ts`, `client/src/hooks/use-messages.ts`, `client/src/hooks/use-admin.ts`: добавлен заголовок `X-App-Access-Token` при наличии токена.
  - `client/src/hooks/use-section3.ts`: запрос `/api/worklog/section3` теперь тоже отправляет `X-Telegram-Init-Data` / `X-App-Access-Token` (иначе ЖР не обновлялся в MiniApp/production).
  - `client/src/pages/Home.tsx`: явный баннер/экран для браузера вне Telegram — если не задан или неверный access-token, показывается подсказка и кнопка перехода на `/login`.

---

## [2026-02-25] - График работ: UX-исправления диалога «Редактирование задачи»
### Исправлено
- Кнопки «Сохранить» и «Отмена» теперь всегда в одной горизонтальной строке (заменён `DialogFooter` на `div flex-row`)
- Поле «Длительность (дни)» теперь можно очистить и ввести новое значение (state — `string`, фильтр `/[^\d]/g`)
- После нажатия «Сохранить» диалог остаётся открытым, показывается toast «Сохранено» (2 с) — вместо закрытия
- После возврата из «Управление материалами» диалог снова открывается: добавлен `sessionStorage.setItem("scheduleEditTaskId")` перед навигацией в SelectTaskMaterials
- Исправлен race condition: если `openEditRef.current` ещё `null` при mount, задача ставится в pending-очередь
- Кнопка «Отмена» теперь явно сбрасывает `selectedTask(null)` вместе с `setEditOpen(false)`

### Затронутые файлы
- `client/src/pages/Schedule.tsx`

---

## [2026-02-25] - График работ: стабильность диалога «Редактирование задачи» на мобильных
### Исправлено
- Диалог «Редактирование задачи» больше не «ездит» влево-вправо при свайпе на телефоне: добавлены `touch-pan-y`, `overscroll-contain`, `overflow-x-hidden` на контейнер и скролл-область, `touch-none` на overlay
- Клавиатура появляется только после клика по редактируемому полю (номер акта, длительность и т.д.), а не при открытии диалога: добавлен `onOpenAutoFocus={(e) => e.preventDefault()}` в DialogContent

### Затронутые файлы
- `client/src/pages/Schedule.tsx`: onOpenAutoFocus, touch-pan-y, overscroll-contain для диалога редактирования задачи
- `client/src/components/ui/dialog.tsx`: touch-none на overlay для блокировки свайпов фона

---

## [2026-02-24] - Улучшение UX всплывающих уведомлений (toast) на вкладке "Акты"
### Изменено
- Кнопка закрытия (крестик) на всплывающих уведомлениях теперь всегда хорошо видна (изменена прозрачность с `opacity-0` на `opacity-100`)
- Добавлена поддержка автоматического закрытия уведомлений через параметр `duration` в функции `toast()`
- Все успешные уведомления на вкладке "Акты" теперь автоматически исчезают через 3,5 секунды:
  - "Акты обновлены" (после синхронизации с графиком)
  - "Успех" (при экспорте PDF-документов)
  - "Синхронизация" (при запуске формирования актов)
- Уведомления об ошибках остаются без автозакрытия для обеспечения видимости важных сообщений

### Затронутые файлы
- `client/src/components/ui/toast.tsx`: улучшена видимость кнопки закрытия
- `client/src/hooks/use-toast.ts`: добавлена поддержка параметра `duration` для автоматического закрытия
- `client/src/pages/Acts.tsx`: добавлен параметр `duration: 3500` для всех успешных уведомлений

---

## [2026-02-24] - График работ: управление материалами задачи через отдельный экран
### Добавлено
- `client/src/pages/SelectTaskMaterials.tsx`: новая полноэкранная страница для управления материалами задачи графика с ручным сохранением
- Плавающая кнопка "Сохранить изменения" появляется при наличии несохранённых изменений
- Роут `/select-task-materials` в `client/src/App.tsx`
- Переводы для новой страницы в `client/src/lib/i18n.ts` (en/ru): `selectTaskMaterials.*`
- Возможность изменения порядка материалов через кнопки "Вверх/Вниз"
- Поля для batch ID, quality document ID и примечания для каждого материала
- Диалог добавления материала с поиском по названию

### Изменено
- `client/src/pages/Schedule.tsx`: компонент `TaskMaterialsEditor` заменён на кнопку "Управление материалами", которая открывает отдельный экран
- Навигация использует wouter с передачей `taskId` через `history.state`
- Удалены неиспользуемые импорты: `TaskMaterialsEditor`, `ProjectMaterialOption`, `TaskMaterialEditorItem`
- Удалены состояния `editMaterials`, `setEditMaterials` и связанная логика из диалога редактирования задачи
- Убран вызов `replaceTaskMaterials` из функции `saveEdit` (сохранение происходит на отдельной странице)
- `client/src/pages/SelectTaskMaterials.tsx`: кнопка "Добавить материал" перемещена в начало страницы (теперь отображается первой, перед списком материалов)

### Исправлено
- `client/src/pages/SelectTaskMaterials.tsx`: исправлен бесконечный цикл debounce (заменён useState на useRef для timeout)
- `client/src/pages/SelectTaskMaterials.tsx`: добавлена валидация taskId в функции saveChanges
- `client/src/pages/SelectTaskMaterials.tsx`: добавлена валидация числовых полей (batchId, qualityDocumentId) - только положительные целые числа
- `client/src/pages/SelectTaskMaterials.tsx`: оптимизация производительности - обёрнуты callback-функции в useCallback
- `client/src/pages/SelectTaskMaterials.tsx`: улучшена типизация - заменены any[] на конкретные типы (ProjectMaterial)
- `client/src/pages/Schedule.tsx`: добавлен отсутствующий вызов хука useProjectMaterials для загрузки материалов проекта
- `client/src/pages/SelectTaskMaterials.tsx`: убрано автосохранение (debounce) - теперь сохранение происходит только при явных действиях пользователя
- `client/src/pages/SelectTaskMaterials.tsx`: сохранение происходит при нажатии кнопки "Сохранить изменения" или при уходе со страницы (кнопка "Назад")
- `client/src/pages/SelectTaskMaterials.tsx`: toast-уведомление "Изменения сохранены" показывается только при ручном сохранении
- `client/src/pages/SelectTaskMaterials.tsx`: индикатор "Сохранение..." в заголовке показывается только во время реального сохранения

---

## [2026-02-24] - График работ: выбор типа акта через отдельный экран
### Добавлено
- `client/src/pages/SelectActTemplate.tsx`: новая полноэкранная страница для выбора типа акта с поиском, группировкой по категориям и сворачиваемыми разделами
- Роут `/select-act-template` в `client/src/App.tsx`
- Переводы для новой страницы в `client/src/lib/i18n.ts` (en/ru)

### Изменено
- `client/src/pages/Schedule.tsx`: заменён выпадающий Popover с типами актов на кнопку, которая открывает полноэкранный экран выбора
- Навигация использует wouter с передачей состояния через `history.state`
- Удалены неиспользуемые импорты: `Popover`, `Command`, состояния `actTemplatePopoverOpen`, `actTemplateSearch`, `collapsedCategories`
- `client/src/pages/SelectActTemplate.tsx`: все категории типов актов свёрнуты по умолчанию; раскрывается только категория с текущим выбранным шаблоном (если есть)

### Исправлено
- Нет

---

## [2026-02-24] - Коллекции ВОР с аккордеоном и таблицами (Phases A-D)

### Добавлено
- **Phase A (DB + API basics):**
  - Таблицы `work_collections`, `work_sections` для группировки позиций ВОР по коллекциям и разделам
  - Расширена таблица `works` полями: `workCollectionId`, `sectionId`, `lineNo`, `notes`, стоимостные поля, `orderIndex`
  - API endpoints: `GET /api/work-collections`, `GET /api/work-collections/:id`, `POST /api/work-collections/import`, `DELETE /api/work-collections/:id`
  - SQL миграции: `0015_work_collections.sql`
- **Phase B (Frontend):**
  - Хуки `useWorkCollections`, `useWorkCollection`, `useImportWorkCollection`, `useDeleteWorkCollection`
  - Селектор коллекций ВОР на вкладке "Ведомость (ВОР)"
  - Аккордеон с разделами и табличное отображение позиций ВОР (аналог вкладки "Смета")
  - Поиск по коду, названию и примечаниям с фильтрацией по секциям
  - Функция удаления коллекции ВОР с диалогом подтверждения при конфликте с графиком
- **Phase C (Resources):**
  - Таблица `work_resources` для детализации ресурсов позиций ВОР (аналог `position_resources`)
  - API поддержка ресурсов в `getWorkCollectionWithDetails` и `importWorkCollection`
  - Раскрываемая таблица ресурсов под каждой позицией во вкладке "Ведомость"
  - SQL миграции: `0016_work_resources.sql`
- **Phase D (Integration):**
  - Поле `work_collection_id` в таблице `schedules` для привязки графика к конкретной коллекции ВОР
  - Автоматическая миграция существующих графиков к дефолтной коллекции ВОР
  - SQL миграции: `0017_schedules_work_collection_id.sql`

### Изменено
- Вкладка "Ведомость (ВОР)": карточки заменены на аккордеон с таблицами по разделам
- Импорт ВОР теперь создаёт коллекцию (пока без секций, в будущем парсер будет расширен)

## [2026-02-24] - Смета: добавлен поиск по коду и названию
### Добавлено
- `client/src/pages/Works.tsx`: на вкладке «Смета (ЛС)» добавлено поле поиска (как во «Ведомость»): фильтрация позиций по коду, названию и примечанию; отображаются только разделы с совпадениями; при пустом результате — сообщение «По запросу ничего не найдено»

## [2026-02-24] - ВОР: удалена функция ручного добавления позиции
### Удалено
- `client/src/pages/Works.tsx`: убраны FAB «+», диалог «Добавить работу», хук `useCreateWork`, состояние формы и обработчик `handleCreate`; позиции ВОР добавляются только через импорт Excel

## [2026-02-23] - Schedule: статусы заменены на «акт N · ТЗ · БРГ»
### Изменено
- `client/src/pages/Schedule.tsx`: вместо статусов «ПРИНЯТО/В РАБОТЕ» в строке задачи показывается `акт N` (или `акт -` если номер не назначен) + трудозатраты ТЗ (из сметы, иначе `0`) + БРГ (`0 чел`, перспективное поле)

## [2026-02-23] - SourceData: исправлена карусель участников на мобильных
### Исправлено
- `client/src/pages/SourceData.tsx`: карточки «Заказчик / Подрядчик / Проектировщик / Ответственные лица» вынесены из компонента `ScrollArea` в отдельный нативный горизонтально-прокручиваемый контейнер с `touchAction: pan-x` и `-webkit-overflow-scrolling: touch`, что устраняет блокировку горизонтального свайпа на Telegram Mobile

## [2026-02-23] - Schedule: UX выпадающего списка шаблонов актов
### Изменено
- `client/src/pages/Schedule.tsx`: группы шаблонов актов теперь свёрнуты по умолчанию при открытии (кроме группы с уже выбранным шаблоном)
- `client/src/pages/Schedule.tsx`: заголовки категорий крупнее (`py-3`), chevron-стрелка перенесена влево (рядом с текстом), стала чуть больше (`h-4 w-4`), текст категории стал более контрастным (`text-foreground`)
- `client/src/pages/Schedule.tsx`: строки шаблонов стали выше (`py-2 min-h-10`), текст теперь переносится на следующую строку вместо обрезания (`whitespace-normal break-words`)
- `client/src/pages/Schedule.tsx`: добавлена подсказка «Нажмите на раздел, чтобы раскрыть» под строкой поиска

## [2026-02-23] - Schedule: исправлено редактирование «Номер акта» на iOS
### Исправлено
- `client/src/pages/Schedule.tsx`: поле «Номер акта» в диалоге редактирования задачи переведено на `type="text"` + `inputMode="numeric"` (вместо `type="number"`), чтобы в Telegram iOS WebView можно было удалять и заменять цифры

## [2026-02-23] - Исходные данные: наименование объекта максимально сверху
### Изменено
- `client/src/pages/SourceData.tsx`: селектор «Объект: …» и строка адреса вынесены из прокручиваемой области и закреплены сразу под `Header`, чтобы всегда отображаться выше блока «Стороны/участники»

## [2026-02-23] - Исходные данные: удалено демо-заполнение
### Удалено
- `client/src/pages/SourceData.tsx`: убрана кнопка «Тестовые данные» и встроенные тестовые данные (функции `demoSourceData()`/`fillDemo()`)

## [2026-02-23] - WorkLog: таблицы Разделов 1/2/4 — удобный горизонтальный скролл; табы — крупнее
### Изменено
- `client/src/pages/WorkLog.tsx`: для Разделов 1/2/4 добавлена явная подсказка «листайте влево/вправо», усилен горизонтальный скролл таблиц (touch-pan-x + min-width) и добавлены градиентные края как индикатор прокрутки
- `client/src/pages/WorkLog.tsx`: плашки вкладок карусели («Разд. 1…») сделаны крупнее; добавлен визуальный намёк, что список табов прокручивается горизонтально

## [2026-02-23] - Акты: «Скачать» сохраняет PDF в Telegram
### Исправлено
- `client/src/pages/Acts.tsx`: кнопка «Скачать» больше не использует `window.open()` (который в Telegram WebView часто открывает только предпросмотр без сохранения); теперь инициируется скачивание через `Telegram.WebApp.openLink()` (если доступно) и fallback на `<a download>`
- `server/routes.ts`: `/api/pdfs/:filename` поддерживает `?download=1` и отдаёт PDF с `Content-Disposition: attachment`; добавлена валидация имени файла (защита от path traversal)

## [2026-02-23] - WorkLog: удалён плавающий FAB «+»
### Удалено
- `client/src/pages/WorkLog.tsx`: убрана круглая плавающая кнопка «+» (FAB) на вкладке «Разд. 3», чтобы не дублировать CTA «Добавить новую запись»

## [2026-02-23] - UI: белый текст на primary/filled кнопках
### Исправлено
- `client/src/components/ui/button.tsx`: для `variant="default"` закреплён `text-white`, чтобы текст на залитых primary-кнопках не сливался с фоном в темах Telegram
- `client/src/index.css`: убрана глобальная стилизация всех `<button>` под Telegram-тему (она ломала pill/табы и делала текст на некоторых кнопках нечитабельным)
- `client/src/pages/Works.tsx`, `client/src/pages/Schedule.tsx`: проблемные pill/табы переведены на общий `Button` (filled/active состояния теперь с белым текстом)
- `client/src/pages/Works.tsx`: вкладки «Ведомость (ВОР) / Смета (ЛС)» оформлены в стиле outline с синей рамкой

## [2026-02-23] - Admin Panel — Панель администратора

### Добавлено
- `migrations/0014_admin_panel.sql` — таблица `admin_users` (хранит Telegram userId администраторов) + поле `is_blocked` в `objects`
- `server/middleware/adminAuth.ts` — middleware `requireAdmin`: проверяет принадлежность к таблице `admin_users`; в dev-режиме принимает заголовок `X-Admin-Override: true`
- `server/storage.ts` — объект `adminStorage` с методами: `listUsers`, `blockUser`, `unblockUser`, `makeAdmin`, `removeAdmin`, `getStats`, `getFailedMessages`, `createCatalogMaterial`, `updateCatalogMaterial`, `deleteCatalogMaterial`, `listAdmins`
- Admin API (`server/routes.ts`): `GET /api/admin/users`, `POST /api/admin/users/:id/block|unblock|make-admin`, `DELETE /api/admin/users/:id/admin`, `GET /api/admin/stats`, `GET /api/admin/messages/failed`, `POST /api/admin/messages/:id/reprocess`, `POST|PATCH|DELETE /api/admin/materials-catalog/:id`, `GET /api/admin/admins` — все защищены `requireAdmin`
- `client/src/hooks/use-admin.ts` — хуки: `useAdminStats`, `useAdminUsers`, `useBlockUser`, `useUnblockUser`, `useMakeAdmin`, `useRemoveAdmin`, `useFailedMessages`, `useReprocessMessage`, `useAdminMaterials`, `useAdminCreateMaterial`, `useAdminUpdateMaterial`, `useAdminDeleteMaterial`
- Frontend страницы: `AdminLayout.tsx` (layout с сайдбаром), `AdminDashboard.tsx` (статистика), `AdminUsers.tsx` (управление пользователями), `AdminMessages.tsx` (очередь AI), `AdminMaterials.tsx` (справочник материалов)
- Роуты: `/admin`, `/admin/users`, `/admin/messages`, `/admin/materials` в `App.tsx`
- Ссылка на Admin Panel в `Settings.tsx` (видна только в dev-режиме)

### Безопасность
- `requireAdmin` использует `=== 'development'` (а не `!== 'production'`) для dev-override
- Валидация `telegramUserId` в `blockUser/unblockUser`: `parseInt` + проверка `isFinite`
- `getStats` — `DISTINCT telegram_user_id` для корректного подсчёта уникальных пользователей

### Производительность
- `listUsers()`: устранён N+1 — используется `Promise.all` для параллельного получения counts
- `getStats()`: 6 count-запросов выполняются через `Promise.all`

## [2026-02-23] - Ручная очистка журнала чата + эндпоинт DELETE /api/messages

### Добавлено
- `DELETE /api/messages` — новый серверный маршрут для очистки всех сообщений текущего пользователя (защищён `telegramAuthMiddleware`)
- `useClearMessages()` — React Query хук для вызова нового маршрута
- Кнопка «Очистить историю» на главной странице (`/`): появляется когда есть хотя бы одно сообщение; требует подтверждения через AlertDialog; сообщает что акты и график остаются нетронутыми

## [2026-02-23] - Очистка сообщений ЖР при удалении ВОР/Сметы

### Изменено
- `server/storage.ts`: добавлен метод `clearMessages(userId?: string)` — удаляет все сообщения пользователя (или все, если userId не передан)
- `server/routes.ts`: `DELETE /api/works` и `DELETE /api/estimates/:id` теперь также очищают сообщения текущего пользователя после основной операции
- `client/src/hooks/use-works.ts`: `useClearWorks.onSuccess` инвалидирует кеш сообщений (`api.messages.list.path`)
- `client/src/hooks/use-estimates.ts`: `useDeleteEstimate.onSuccess` инвалидирует кеш сообщений

## [2026-02-23] - MVP: изоляция данных пользователя и UX-доработки

### Добавлено
- **Серверная фильтрация сообщений по `userId`**: маршруты `GET/POST/PATCH /api/messages` и `GET /api/worklog/section3` теперь применяют `telegramAuthMiddleware` и фильтруют данные по идентифицированному пользователю Telegram
- **SQL-миграция `0013_messages_object_id`**: поле `object_id` (nullable FK → `objects`) добавлено в таблицу `messages` для привязки сообщений к объекту строительства; созданы индексы `messages_object_id_idx` и `messages_user_id_idx`
- **Onboarding-баннер** на главной странице (`/`): пошаговая карточка «С чего начать?» для новых пользователей (скрывается кнопкой ×, состояние сохраняется в localStorage)
- **Pill-фильтры на `/schedule`**: кнопка-заглушка «Фильтры» заменена на переключатель «Все / С актом / Без акта» для фильтрации задач Ганта на клиенте

### Изменено
- `client/src/pages/Home.tsx`: `currentUser` теперь берётся из `useTelegram().user.id` (в dev-режиме — `"dev_user"`)
- `server/storage.ts`: `getMessages()` принимает необязательный параметр `userId?: string` для WHERE-фильтрации
- `server/routes.ts`: при `POST /api/messages` `objectId` текущего объекта пользователя сохраняется вместе с сообщением
- `shared/schema.ts`: поле `objectId` добавлено в таблицу `messages`

## [2026-02-23] - Восстановлен Гант на мобильных в вкладке График работ

### Изменено
- Таблица Ганта теперь видна на мобильных: убран `hidden md:block` с правой колонки, добавлена горизонтальная прокрутка (`overflow-x-auto`) для всей таблицы (header + body скроллятся синхронно)
- Левая колонка задач: `160px` на мобильных / `400px` на десктопе (было `flex-1` — занимала 100% ширины)
- Блок с датой (dd/MMM/EEE) скрыт на мобильных (`hidden md:block`) для экономии места
- Кнопки сдвига задач (ChevronLeft/Right) скрыты на мобильных (`hidden md:inline-flex`), доступны через десктоп; кнопка редактирования (MoreVertical) остаётся всегда

## [2026-02-23] - Удалена дублирующая кнопка "Сформировать акты" на вкладке График работ

### Удалено
- Кнопка "Сформировать акты" в `Schedule.tsx` — дублировала функциональность кнопки "Сформировать/обновить из графика" на вкладке Акты (оба вызывали `POST /api/schedules/:id/generate-acts`)
- Удалены неиспользуемые: импорт `useGenerateActsFromSchedule`, переменная `generateActs`, функция `handleGenerateActs`, иконка `SlidersHorizontal`

## [2026-02-23] - Header: бутерброд-меню + молния-ссылка на чат

### Изменено
- **`Header.tsx`** — левый слот заменён с декоративной молнии на кнопку-бутерброд (`Menu`), открывающую Sheet-меню со ссылками на «Настройки» и «Журнал работ (чат)»
- Правый слот: добавлена иконка молнии (`Zap`) как кликабельная ссылка на `/` (чат) — отображается только когда `showBack=false`
- Добавлен проп `showZapLink?: boolean` (default `true`) для управления видимостью молнии

### Исправлено
- **`BottomNav.tsx`** — вкладка «ЖР» теперь ведёт на `/worklog` (журнал с разделами) вместо `/` (чат)

## [2026-02-23] - Fix WorkLog: восстановлены таблицы разделов 1, 2, 4, 5

### Исправлено
- **`WorkLog.tsx`** — восстановлены официальные таблицы разделов 1, 2, 4, 5 (были заменены на PlaceholderSection в Шаге 7)
- Добавлены аббревиатуры вкладок «Разд. 1», «Разд. 2», «Разд. 3», «Разд. 4» соответствующие референсу (вместо «Раздел 1»)
- Раздел 3 сохранён в новом list-формате из Шага 7 (список с датой, badge, kebab, прогресс, FAB)
- Разделы 1 и 2 содержат официальные таблицы с заголовками и пустыми строками
- Разделы 4 и 5 также восстановлены с формальными таблицами ОЖР
- Раздел 6 и Титул — плейсхолдер с кнопками действий (без изменений)

## [2026-02-23] - UI Redesign Шаг 7: WorkLog — список-UI + FAB + прогресс

### Изменено
- **`WorkLog.tsx`** — полная замена квадратных табов на pill-скролл; `Tabs*` из shadcn убраны, управление через `useState<TabValue>`
- Раздел 3: таблица заменена на список записей — дата (число/день недели/месяц) слева, статус-badge «ПРИНЯТО»/«В РАБОТЕ», `MoreVertical` kebab, текст сегментов с инлайн-редактированием
- Info-badge над списком с заголовком раздела и чипом месяца последней записи
- Блок «Добавить новую запись» с иконкой `+` и пояснением
- «ОБЩИЙ ПРОГРЕСС N%» рассчитывается автоматически (processedSegs / totalSegs)
- FAB «+» синий (показывается только на вкладке section3)
- Убраны: `SectionActionBar`, `Construction`, `Pencil`, `Save`, `Search`, `ScrollArea`, `Tabs*`

## [2026-02-23] - UI Redesign Шаг 6: Settings — профиль, секции, тумблеры

### Изменено
- **`Settings.tsx`** — полный редизайн в стиле iOS/Android Settings: фон `bg-muted/30`, карточки `bg-card`
- Профиль-блок: аватар с инициалом (синий кружок), имя из Telegram `user`, `@username`, онлайн-точка
- Язык: pill-переключатель Русский/English вместо RadioGroup
- Секции с uppercase-лейблами: ЯЗЫК ИНТЕРФЕЙСА / ЖУРНАЛ РАБОТ / О ПРИЛОЖЕНИИ — карточки с `divide-y`
- Switch-строка для `showWorkVolumes` с хинтом
- Секция "О приложении": версия 1.0.0 + статус Telegram MiniApp (Активно/Dev режим)
- Красная кнопка "Выйти из аккаунта" с toast-заглушкой

## [2026-02-23] - UI Redesign Шаг 5: Материалы / Исходные — стиль дашборда Energosnab

### Изменено
- **`MaterialCard.tsx`** — полный редизайн по макету: название + badge "Справочник"/"Локальный" + `CheckCircle2`/`AlertTriangle` статус; счётчики ПАРТИИ/ДОКУМЕНТЫ с иконками; amber warning-блок; кнопка "Подробнее →"; новые props `unit`, `isFromCatalog`, `warningText`
- **`SourceMaterials.tsx`** — subtitle в Header (`ПРОЕКТ:`); pill-фильтры вместо Button; строка "список позиций (N) Сбросить"; нативный скролл вместо ScrollArea; `MaterialCard` получает `unit`, `isFromCatalog`
- **`SourceData.tsx`** — цветная полоса `h-1` сверху карточек сторон (зелёная/серая); `hover:bg-muted/20` на карточки секций; плавающая pill-кнопка "Сохранить изменения" при наличии несохранённых изменений

## [2026-02-23] - UI Redesign Шаг 4: Schedule — стилизация строк задач + адаптив

### Изменено
- **`Schedule.tsx`** — строки задач переработаны: дата (день+месяц+день недели) слева, статус-badge «ПРИНЯТО»/«В РАБОТЕ», кнопки сдвига + MoreVertical-kebab справа, название `line-clamp-2`, код + объём мелко под описанием
- Gantt-таймлайн скрыт на мобильных (`hidden md:block`), левая панель адаптивна (`flex-1 md:w-[400px]`)
- CTA «Сформировать акты» увеличена до `h-12`

## [2026-02-23] - UI Redesign Шаг 3: Works — карточный список ВОР + импорт

### Изменено
- **`WorkItemCard.tsx`** — убран прогресс-бар с `Math.random()`; компактная карточка: код (mono, primary) + pill с объёмом справа, описание `line-clamp-2`
- **`Works.tsx`** — segmented pill-переключатель вместо двух кнопок; поиск в стиле `bg-muted/50`; зона импорта — крупная карточка с иконкой и кнопками «Выбрать файл» / «Очистить»; список работ — `WorkItemCard` вместо таблицы (страница скроллится целиком); все `data-testid` и диалоги сохранены

## [2026-02-23] - UI Redesign Шаг 2: Home чат + WorkMatchCard + инпут-панель

### Изменено
- **`MessageBubble.tsx`** — bubble пользователя: `bg-primary text-white`, `rounded-2xl rounded-tr-sm`, время/галочки внутри; новый компонент `WorkMatchCard` с тремя состояниями (loading, error, success)
- **`WorkMatchCard`** — лейбл «РАБОТА УСПЕШНО СОПОСТАВЛЕНА», код ВОР 18px bold, описание курсивом в кавычках, объём `Box`+число+единица, кнопка «Детали →», pill-кнопки «ФОТО/ФАЙЛ» и «ИСТОРИЯ» у последнего сообщения
- **`Home.tsx`** — инпут-панель: микрофон внутри Textarea, круглая синяя кнопка отправки, подпись «ИИ автоматически распознаёт...»; `showActions` передаётся только последнему обработанному сообщению

## [2026-02-23] - UI Redesign Шаг 1: Header + BottomNav по дизайн-референсу

### Изменено
- **`Header.tsx`** — вариативный компонент: новые props `subtitle`, `showBack`, `onBack`, `showSearch`, `showAvatar`, `rightAction`; логотип (синий кружок с `Zap`) вместо Menu-кнопки; убран DropdownMenu с настройками
- **`BottomNav.tsx`** — 5 вкладок по макету (ВОР `/works`, График `/schedule`, Акты `/acts`, ЖР `/`, Исходные `/source-data`); иконки `ClipboardList`, `CalendarRange`, `FileCheck`, `MessageSquare`, `FolderOpen`; убран pill-фон активной вкладки; `strokeWidth=1.5/2`
- **Все страницы** (`Home`, `Works`, `Schedule`, `WorkLog`, `Acts`, `SourceData`) — добавлен `subtitle` с названием объекта из `useCurrentObject()`



## [2026-02-20] - Telegram MiniApp: Серверная валидация и привязка к userId

### Добавлено
- **Middleware для валидации Telegram initData**: `server/middleware/telegramAuth.ts`
  - Проверка подписи HMAC-SHA-256 с использованием Bot Token
  - Извлечение данных пользователя из initData
  - Добавление `req.telegramUser` и `req.telegramInitData` в Express Request
  - Поддержка опциональной аутентификации в dev-режиме
  - Утилита `createMockInitData()` для генерации тестовых данных
- **Поле `telegramUserId` в таблице `objects`**: миграция `0012_add_telegram_user_id.sql`
  - Привязка объектов строительства к пользователям Telegram
  - Индекс для быстрого поиска по `telegram_user_id`
- **Клиентская интеграция для передачи initData**:
  - `client/src/lib/telegram.ts` — утилиты для работы с Telegram WebApp
  - Обновлён `client/src/lib/queryClient.ts` — автоматическое добавление заголовка `X-Telegram-Init-Data` ко всем API-запросам
- **Документация и инструменты для тестирования**:
  - `docs/telegram-auth-testing.md` — руководство по тестированию аутентификации
  - `scripts/generate-mock-initdata.js` — скрипт для генерации mock initData с валидной подписью
- **Обновлён storage layer**: метод `getOrCreateDefaultObject()` поддерживает фильтрацию по `telegramUserId`

### Изменено
- `server/routes.ts` — добавлен middleware `telegramAuth` к защищённым эндпоинтам
- `shared/schema.ts` — добавлено поле `telegramUserId` в таблицу `objects`
- Задача «Интеграция Telegram MiniApp» в `docs/tasktracker.md` — шаги 6-7 завершены

### Безопасность
- Серверная валидация initData защищает от подделки данных пользователя
- В production режиме все защищённые эндпоинты требуют валидный initData
- В dev-режиме аутентификация опциональна для удобства разработки

---

## [2026-02-20] - Telegram MiniApp: Бот, нативные кнопки и Haptic Feedback

### Добавлено
- **Документация по созданию Telegram-бота**: `docs/telegram-bot-setup.md` — пошаговая инструкция по созданию бота через @BotFather, настройке Web App URL и получению Bot Token
- **Переменная окружения `TELEGRAM_BOT_TOKEN`**: добавлена в `.env` с подробными комментариями для серверной валидации initData
- **Хуки для нативных кнопок Telegram**:
  - `client/src/hooks/use-telegram-main-button.ts` — управление MainButton (главная кнопка действия)
  - `client/src/hooks/use-telegram-back-button.ts` — управление BackButton (кнопка "Назад")
  - Документация: `docs/telegram-buttons-guide.md` с примерами использования и best practices
- **Хук для тактильной обратной связи**: `client/src/hooks/use-telegram-haptic.ts` — интеграция HapticFeedback API для улучшения UX
  - Поддержка impact (light/medium/heavy/rigid/soft)
  - Поддержка notification (success/error/warning)
  - Поддержка selectionChanged для навигации
  - Утилита `haptic` для использования вне React компонентов
  - Документация: `docs/telegram-haptic-guide.md` с матрицей использования и примерами
- **Обновлена документация проекта**: `docs/project.md` — добавлена информация о новых возможностях Telegram MiniApp

### Изменено
- Задача «Интеграция Telegram MiniApp» в `docs/tasktracker.md` — шаги 8-10 завершены, задача помечена как "Завершена"

---

## [2026-02-20] - Code review и исправления Telegram WebApp интеграции

### Исправлено
- **`useTelegram.ts`** (критическое): хук переписан с `useState<TelegramWebApp>` на `useRef` — теперь ссылка на оригинальный объект SDK сохраняется, методы прототипа не теряются при событии `themeChanged`/`viewportChanged`. Реактивный state ограничен только `themeParams`, `colorScheme`, `viewportHeight`, `isExpanded`.
- **`useTelegram.ts`** (среднее): mock-данные для разработки (`MOCK_USER`, `MOCK_THEME_PARAMS`) теперь возвращаются только при `import.meta.env.DEV`, а не в production-сборке.
- **`use-telegram-back-button.ts`**, **`use-telegram-main-button.ts`** (среднее): получение `BackButton`/`MainButton` перенесено внутрь `useEffect` — устранён race condition при загрузке SDK. `useCallback`-и обращаются к `window.Telegram` напрямую.
- **`use-telegram-haptic.ts`** (среднее): `HapticFeedback` читается внутри callback-а, `useCallback` без deps — нет захвата потенциально `undefined` замыкания.
- **`use-telegram-main-button.ts`**: несколько отдельных вызовов `setText`/`setParams` объединены в один `setParams` вызов.
- **`TelegramThemeProvider.tsx`**: удалены закомментированные строки.
- **`telegram.d.ts`**: добавлен `TelegramEventType` union type; `onEvent`/`offEvent` принимают только валидные типы событий вместо `string`.

### Добавлено
- JSDoc в `use-telegram-back-button.ts` и `use-telegram-main-button.ts` с предупреждением о необходимости стабильных ссылок на `onClick` (через `useCallback`).

---

## [2026-02-20] - Подключение Telegram WebApp SDK

### Добавлено
- Telegram WebApp SDK (`telegram-web-app.js`) подключён в `client/index.html`
- Инициализация `WebApp.ready()` и `WebApp.expand()` в `client/src/main.tsx` — приложение сообщает Telegram о готовности и разворачивается на полный экран
- Задача «Интеграция Telegram MiniApp» с 10 этапами добавлена в `docs/tasktracker.md`

---

## [2026-02-20] - Безопасный workflow генерации миграций (db:generate только dev)

### Добавлено
- `scripts/db-generate.js`: обёртка над `drizzle-kit generate`, блокирует запуск в `NODE_ENV=production` с явной ошибкой
- `npm run db:generate` в `package.json` — dev-only скрипт для генерации SQL-миграций из `shared/schema.ts`

### Изменено
- `npm run db:push` теперь всегда завершается ошибкой с пояснением (`drizzle-kit push` запрещён в проекте)
- `docs/db-migrations.md`: добавлен раздел **Workflow работы с миграциями** с описанием `db:generate` (dev), `db:migrate` (dev+prod), `db:push` (запрещён)

---

## [2026-02-20] - Bootstrap-документация и CI-проверка миграций на чистой БД

### Добавлено
- `docs/bootstrap.md`: пошаговая инструкция «с нуля» — Postgres (Docker или вручную), `.env`, `npm run build`, `npm run db:migrate`, проверка через `\dt` и SELECT
- `.github/workflows/test-migrations.yml`: CI job, который при каждом пуше и PR поднимает чистый Postgres, применяет все миграции и проверяет наличие ключевых таблиц (`works`, `acts`, `messages`, `schedules`, `schedule_tasks`, `act_templates`, `act_template_selections`, `attachments`, `schema_migrations`)

---

## [2026-02-20] - Устранены ложные комментарии про drizzle-kit push в миграциях

### Изменено
- `migrations/0001_objects_source_data.sql`, `0002_estimates.sql`, `0005_materials_documents.sql`: заменены NOTE-комментарии «Project currently uses drizzle-kit push as the primary schema sync mechanism» на корректные — «Единственный способ изменения БД — SQL-миграции; drizzle-kit push в проекте не применяется»
- `migrations/0000_initial_schema.sql`: уточнена историческая ремарка — явно указано, что bootstrapped через push относится к прошлому, а текущая политика — только SQL-миграции
- `setup-db.sh`: подсказка `npm run db:push` заменена на `npm run db:migrate`
- `replit.md`: описание управления схемой БД исправлено — «Schema managed via SQL migrations (`npm run db:migrate`)»

---

## [2026-02-20] - Убрана зависимость db:migrate от tsx в production

### Изменено
- `script/build.ts`: добавлен шаг компиляции `script/db-migrate.ts` → `dist/db-migrate.cjs` через esbuild (bundle: true, format: cjs)
- `package.json`: скрипт `db:migrate` изменён с `tsx script/db-migrate.ts` на `node dist/db-migrate.cjs` — теперь работает в production без devDependencies

---

## [2026-02-20] - Bootstrap-миграция для пустой БД

### Добавлено
- `migrations/0000_initial_schema.sql` — начальная миграция, создающая все базовые таблицы, которые ранее существовали только через `drizzle-kit push`: `works`, `act_templates`, `messages`, `acts`, `attachments`, `act_template_selections`, `schedules`, `schedule_tasks`. Теперь `npm run db:migrate` на чистой БД проходит полностью без ошибок.

---

## [2026-02-19] - Исправление парсинга позиций со звёздочкой в ГРАНД-Смете

### Исправлено
- `client/src/lib/estimateParser.ts`: добавлена функция `normalizeLineNo()`, которая отрезает суффикс `\n*` от номеров строк. В ГРАНД-Смете позиции с индивидуальной ценой экспортируются с маркером `*` через перенос строки (напр. `"10\n*"`). Из-за этого `isLineNo` возвращал `false` и позиции не определялись.
- Позиции 10*, 11* (вспомогательные к поз. 9) и 23*, 26*, 27* (вспомогательные к поз. 22) теперь корректно парсятся и попадают в БД.

---

## [2026-02-19] - Раздел 3: inline-редактирование сегментов сообщений

### Добавлено
- `PATCH /api/messages/:id` — API для редактирования сообщений (обновление `messageRaw` и/или `normalizedData`)
- `server/storage.ts`: метод `patchMessage(id, data)` — частичное обновление сообщения с merge `normalizedData`
- `client/src/hooks/use-messages.ts`: хук `usePatchMessage()` для редактирования сообщений
- `client/src/pages/WorkLog.tsx`: inline-редактирование сегментов с `sourceType: 'message'` — клик по сегменту открывает textarea с кнопками «Сохранить»/«Отмена»
- `client/src/hooks/use-section3.ts`: параметр `enablePolling` для управления автообновлением (отключается на время редактирования)

### Изменено
- Сегменты из сообщений теперь кликабельны и редактируемые (hover-эффект, курсор pointer)
- При редактировании polling отключается автоматически, возобновляется после сохранения/отмены
- Для обработанных сообщений (`isProcessed: true`) редактируется `normalizedData.workDescription`, для pending — `messageRaw`
- `client/src/pages/WorkLog.tsx`: оформление таблицы **раздела 3** приведено к единому стилю “печатных” разделов (как в разделе 2) — убраны синие границы/заливки, унифицированы рамки и курсивные заголовки

---

## [2026-02-19] - Раздел 3: группировка по датам (segments)

### Изменено
- Раздел 3 теперь показывает **одну строку на дату**: все работы из актов и сообщений за дату объединяются в одну ячейку списком сегментов
- `shared/routes.ts`: `section3RowSchema` переработан — вместо `workDescription` (строка) добавлен `segments[]` с типом `WorkSegment` (`text`, `sourceType`, `sourceId`, `isPending`)
- `server/routes.ts`: эндпоинт `/api/worklog/section3` теперь группирует записи по дате в `Map`; акты добавляются первыми, messages — следом
- `client/src/pages/WorkLog.tsx`: ячейка «Наименование работ» рендерит каждый сегмент отдельным `<div>`, сегменты из messages — приглушённый голубой цвет, pending — курсив

---

## [2026-02-19] - Раздел 3: два источника данных

### Добавлено
- Эндпоинт `GET /api/worklog/section3` — объединяет messages и acts (АОСР)
- Акты разворачиваются в строки: **одна строка на дату**, все работы акта объединяются через точку с запятой
- Строки из messages визуально светлее (редактируемые, `bg-blue-50/20`)
- Строки из актов — стандартный фон (readonly, редактируются через график)
- `shared/routes.ts`: схема `section3RowSchema` и тип `Section3Row`
- `server/routes.ts`: утилита `eachDayInRange(start, end)` для генерации дат
- `client/src/hooks/use-section3.ts`: хук для загрузки данных раздела 3

### Изменено
- `client/src/pages/WorkLog.tsx`: переключён с `useMessages()` на `useSection3()`, обновлена стилизация строк таблицы
- `server/routes.ts` (generate-acts): `dateEnd` теперь включительная — при продолжительности 1 день `dateEnd = dateStart`

---

## [2026-02-18] - Вкладка «Акты»: скачивание без модального окна

### Изменено
- `client/src/pages/Acts.tsx`: по нажатию «Скачать» на карточке акта модальное окно выбора шаблонов не открывается — сразу запускается экспорт в PDF и открывается предпросмотр в новой вкладке; во время генерации на кнопке показывается спиннер

---

## [2026-02-18] - График работ: combobox с поиском и сворачиваемыми группами для выбора типа акта

### Изменено
- `client/src/pages/Schedule.tsx`: выбор типа акта заменён с плоского `Select` на `Popover`+`Command` combobox — категории сворачиваются кликом по заголовку, в заголовке отображается количество актов в категории; при наборе поиска все группы разворачиваются автоматически; выбранный шаблон отображается в кнопке-триггере

---

## [2026-02-18] - График работ: независимые объёмы работ в задачах

### Добавлено
- `migrations/0011_schedule_task_quantity.sql`: поля `quantity` и `unit` в таблице `schedule_tasks`; существующие задачи заполнены из источника (ВОР/Смета)
- `shared/schema.ts`: поля `quantity` (numeric) и `unit` (text) в Drizzle-схеме `scheduleTasks`
- `shared/routes.ts`: поля `quantity` и `unit` в контракте `PATCH /api/schedule-tasks/:id`
- `client/src/pages/Schedule.tsx` (диалог редактирования): поля «Объём» и «Ед. изм.» с предупреждением при превышении суммарного объёма над справочным значением

### Изменено
- `server/storage.ts` — `bootstrapScheduleTasksFromWorks` и `bootstrapScheduleTasksFromEstimate`: при создании задач копируют `quantity`/`unit` из ВОР/Сметы
- `server/storage.ts` — `patchScheduleTask`: добавлена обработка `quantity` и `unit`
- `server/routes.ts` — `generate-acts`: объём в акт теперь берётся из `schedule_tasks.quantity` (суммируется по всем задачам одного вида работ в акте), а не из справочника напрямую
- `client/src/pages/Schedule.tsx`: колонка «Объём» в строке графика показывает `task.quantity` для обоих источников (ВОР и Смета)
- `client/src/hooks/use-schedules.ts`: тип патча `usePatchScheduleTask` расширен полями `quantity` и `unit`

---

## [2026-02-18] - АОСР: шрифт Times New Roman, поле п.1 в форме экспорта
### Добавлено
- `server/fonts/`: скопированы TTF-файлы Times New Roman (TimesNewRoman.ttf, Bold, Italic, BoldItalic) из Windows — шрифт теперь подключён локально и не требует наличия `/mnt/c/Windows/Fonts` на сервере
- Поле **П.1 «Предъявленные работы»** в форму экспорта АОСР на клиенте (`Acts.tsx`): пользователь может вручную переопределить автоматически собранный список работ
- `aosrForm.p1Works` передаётся в `formData` при `POST /api/acts/:id/export`
### Изменено
- `server/routes.ts`: расчёт `p1Works` вынесен до обеих ветвей экспорта (с `templateIds` и без); в обеих ветвях применяется приоритет `formData.p1Works` над авто-значением из `worksData`

## [2026-02-05] - АОСР: акты только из графика (тип акта, материалы/схемы/документация на задаче)
### Добавлено
- БД: миграция `migrations/0010_act_from_schedule_task_data.sql`
  - `schedule_tasks`: `act_template_id`, `project_drawings`, `normative_refs`, `executive_schemes`
  - `acts`: `act_template_id`, `project_drawings_agg`, `normative_refs_agg`, `executive_schemes_agg`
  - новая таблица `task_materials` (материалы, привязанные к задаче графика)
- API:
  - `GET/PUT/POST/DELETE /api/schedule-tasks/:id/materials` — материалы задачи (для п.3 АОСР и приложений)
  - `POST /api/schedules/:id/generate-acts`: ответ расширен `warnings`, `deletedActNumbers`
- Debug: инструментализация логов для диагностики ошибки `Failed to fetch` при импорте сметы (клиентский запрос и серверный обработчик)

### Изменено
- `shared/schema.ts`: добавлены поля актов/задач и таблица `task_materials`
- `shared/routes.ts`: расширен `PATCH /api/schedule-tasks/:id` (тип акта, документация, схемы, `updateAllTasks` + `409`), добавлены контракты `taskMaterials`, расширен ответ `generate-acts`
- `server/routes.ts`:
  - `generate-acts`: теперь собирает тип акта, агрегирует документацию/схемы, переносит материалы задачи в `act_material_usages` и документы в `act_document_attachments`, удаляет акты без задач, формирует `warnings`
  - `POST /api/acts/:id/export`: при отсутствии `templateIds` использует `acts.act_template_id`, а также берёт `project_drawings_agg`/`normative_refs_agg` и добавляет схемы в `attachmentsText`
  - `POST /api/acts/generate`, `POST /api/acts/create-with-templates`: помечены устаревшими (410), создание актов только из графика
- UI:
  - `client/src/pages/Schedule.tsx`: диалог задачи расширен (номер акта, тип акта, материалы задачи, исполнительные схемы, чертежи, нормативы)
  - `client/src/pages/Acts.tsx`: добавлено отображение типа акта, экспорт PDF через диалог; создание актов по датам/шаблонам убрано из основного флоу

### Исправлено
- Миграция `0010_act_from_schedule_task_data.sql`: удаление legacy-актов теперь сначала очищает зависимые записи `act_template_selections`, чтобы не падать по FK (`act_template_selections_act_id_acts_id_fk`)

---

## [2026-02-04] - График работ: двухстрочная левая часть (№/Акт/ед.изм + Объём/ТЗ) и перенос наименования
### Добавлено
- Нет

### Изменено
- `client/src/pages/Schedule.tsx`: переработана левая часть графика работ (табличная часть слева от таймлайна):
  - Ширина левого блока увеличена до `w-[420px]` (заголовок и тело)
  - Строка задачи стала двухстрочной:
    - Строка 1: **№ позиции | Акт № | ед. изм.** (без префикса «Ед.:») + отдельные колонки **«Объём»** и **«ТЗ»**
    - Строка 2: **наименование работ** с переносом и растягиванием под область «Объём/ТЗ»
  - Высота строки увеличена (`rowHeight: 72`) и выравнивание полос Ганта обновлено под новую высоту

### Исправлено
- Нет

---

## [2026-02-03] - График работ: вывод данных позиции сметы (ед. изм., объём, трудозатраты)
### Добавлено
- Нет

### Изменено
- `client/src/pages/Schedule.tsx`: для источника «Смета» в строке задачи дополнительно отображаются данные позиции:
  - **Ед. изм.** — рядом с `Акт №` (в одной строке)
  - **Объём** — справа от наименования работ (в той же строке)
  - **Трудозатраты (чел.-ч)** — по ресурсам позиции (ОТ+ОТМ, при наличии)

### Исправлено
- Нет

---

## [2026-02-03] - Партии материалов: подпись поля «Завод» → «Завод изготовитель»
### Добавлено
- Нет

### Изменено
- В форме партии (`BatchForm.tsx`) подпись поля изменена с «Завод» на «Завод изготовитель». Имя переменной и колонки БД `plant` без изменений.

### Исправлено
- Нет

---

## [2026-02-03] - Партии материалов: удалено поле «Производитель»
### Добавлено
- Нет

### Изменено
- БД: миграция `migrations/0009_drop_material_batches_manufacturer.sql` — удалена колонка `manufacturer` из таблицы `material_batches` (идемпотентный DROP)
- `shared/schema.ts`: удалено поле `manufacturer` из схемы таблицы `material_batches`
- `shared/routes.ts`: удалено поле `manufacturer` из API создания и обновления партии (`POST /api/project-materials/:id/batches`, `PATCH /api/material-batches/:id`)
- `server/storage.ts`: удалён `manufacturer` из типов и патча при создании/обновлении партии
- UI: удалено поле «Производитель» из формы партии (`BatchForm.tsx`), мастера добавления материала (`MaterialWizard.tsx`), страницы материала (`SourceMaterialDetail.tsx`), типа партии в `MaterialDetailView.tsx`

### Исправлено
- Нет

---

## [2026-02-03] - Документы: удалено поле «Кем выдан»
### Добавлено
- Нет

### Изменено
- БД: миграция `migrations/0008_drop_documents_issuer.sql` — удалена колонка `issuer` из таблицы `documents`
- `shared/schema.ts`: удалено поле `issuer` из схемы таблицы `documents`
- `shared/routes.ts`: удалено поле `issuer` из API-контракта создания документа
- `server/storage.ts`: удалён поиск по `issuer` в методе поиска документов (оставлен поиск только по номеру и названию)
- UI: удалено поле «Кем выдан» из всех форм документов (`SourceMaterialDetail`, `MaterialWizard`, `SourceData`, `SourceDocuments`)
- `client/src/components/documents/DocumentCard.tsx`: удалено отображение `issuer` из карточки документа

### Исправлено
- Нет

---

## [2026-02-03] - Карточка материала: удалены неиспользуемые кнопки
### Добавлено
- Нет

### Изменено
- `client/src/components/materials/MaterialCard.tsx`: удалены кнопки «Партии» и «Документы», а также связанные пропсы `onOpenBatches` и `onOpenDocuments` (мёртвый код — пропсы нигде не передавались, кнопки всегда были disabled)

### Исправлено
- Нет

---

## [2026-02-03] - Материалы: привязка документов к партиям поставок (3B)
### Добавлено
- UI: привязка документа к конкретной партии в деталке материала `/source/materials/:id`
- UI: привязка документа к добавленной партии в мастере добавления материала

### Изменено
- `client/src/components/materials/MaterialDetailView.tsx`: документы теперь отображаются по привязкам (с подписью области «На все партии» / «Партия …»), добавлена кнопка привязки документа к конкретной партии
- `client/src/pages/SourceMaterialDetail.tsx`: добавлен выбор цели привязки (к материалу или к партии) и передача `batchId` в `POST /api/document-bindings`
- `client/src/components/materials/MaterialWizard.tsx`: добавлен выбор «к материалу / к добавленной партии» и передача `batchId` при создании привязки

### Исправлено
- Нет

---

## [2026-02-03] - Смета: удаление с предупреждением и сбросом графика/актов
### Добавлено
- UI `/works`: диалог подтверждения удаления сметы, если она используется как источник графика («Удалить и сбросить»)

### Изменено
- API: `DELETE /api/estimates/:id?resetSchedule=1` — если смета используется графиком, сбрасывает задачи графика и очищает списки работ в затронутых актах, затем удаляет смету
- `server/storage.ts`: `deleteEstimate(..., { resetScheduleIfInUse: true })` — безопасное удаление сметы-источника через сброс графика
- `client/src/hooks/use-estimates.ts`: `useDeleteEstimate` поддерживает флаг `resetSchedule` и пробрасывает `status` ошибки для UX-ветвления (409)

### Исправлено
- Нет

---

## [2026-02-03] - ВОР: очистка с предупреждением и сбросом графика/актов (вариант A)
### Добавлено
- UI `/works`: кнопка «Очистить ВОР» с предупреждением («Очистить и сбросить»)

### Изменено
- API: `DELETE /api/works?resetSchedule=1` — если график использует ВОР как источник, удаляет задачи графика и очищает списки работ в затронутых актах, затем очищает ВОР
- `server/storage.ts`: `clearWorks({ resetScheduleIfInUse: true })` — безопасная очистка ВОР при использовании графиком
- `shared/routes.ts`: добавлен контракт `api.works.delete` (опционально `resetSchedule=1`)
- `client/src/hooks/use-works.ts`: добавлен хук `useClearWorks` + инвалидация кэша графиков и актов

### Исправлено
- Нет

---

## [2026-02-03] - Документы: исправление фильтров Select (Radix) на /source/documents
### Добавлено
- Нет

### Изменено
- `client/src/pages/SourceDocuments.tsx`: для пунктов «Все» в фильтрах использован безопасный `value="__all__"` (вместо пустой строки), чтобы избежать runtime-error overlay Radix Select

### Исправлено
- Ошибка `[plugin:runtime-error-plugin] A <Select.Item /> must have a value prop that is not an empty string` на странице документов качества

---

## [2026-02-02] - График работ: статусы документов качества по подстрокам сметы (MVP)
### Добавлено
- DB: миграция `migrations/0007_estimate_position_material_links.sql` — таблица `estimate_position_material_links` (привязка подстроки сметы → материал проекта)
- API: статусы и управление привязками:
  - `GET /api/schedules/:id/estimate-subrows/statuses`
  - `POST /api/estimate-position-links` (upsert)
  - `DELETE /api/estimate-position-links/:estimatePositionId`
- UI `/schedule`: badge статуса на подстроках (none/partial/ok) + диалог привязки материала проекта

### Изменено
- `shared/schema.ts`: добавлена Drizzle-таблица/типы `estimatePositionMaterialLinks`
- `server/storage.ts`: добавлены методы привязок + батч-расчёт статусов на базе `document_bindings`/`documents`
- `shared/routes.ts`: добавлен API-контракт `api.estimatePositionLinks`
- `client/src/pages/Schedule.tsx`: интеграция отображения статусов и управления привязками
- `client/src/hooks/use-estimate-position-links.ts`: новые React Query хуки для статусов/привязок

### Исправлено
- Нет

---

## [2026-02-02] - Смета: корректная ошибка при удалении, если смета используется графиком
### Добавлено
- Нет

### Изменено
- API: `DELETE /api/estimates/:id` теперь возвращает `409` с понятным сообщением, если смета используется как источник графика работ

### Исправлено
- Удаление сметы на вкладке ВОР больше не приводит к `500 Internal Server Error`, когда смета привязана к графику (вместо этого — контролируемая ошибка и подсказка, что нужно сменить источник/очистить график)

---

## [2026-02-02] - График работ: синхронизация таймлайна при раскрытии подстрок
### Добавлено
- Нет

### Изменено
- `client/src/pages/Schedule.tsx`: таймлайн теперь учитывает раскрытые подстроки (высота и позиционирование полос смещаются вместе с левой колонкой)

### Исправлено
- При раскрытии вспомогательных строк (материалов/подстрок сметы) полосы графика больше не “остаются на месте” — выравнивание строк сохранено

---

## [2026-02-02] - Спецификация: статусы документов качества в графике (по подстрокам сметы)
### Добавлено
- Документ `docs/techspec_quality_statuses_schedule.md`: MVP-внедрение и план PRO для статусов документов качества на экране `/schedule`

### Изменено
- Нет

### Исправлено
- Нет

---

## [2026-02-01] - График работ из Сметы (с явным источником в acts.worksData)
### Добавлено
- **Модель данных**: график может строиться из двух источников — ВОР или Смета (`schedules.sourceType`, `schedules.estimateId`)
- **Schedule tasks**: `schedule_tasks.estimatePositionId` для задач из сметы (взаимоисключающее с `workId`)
- **Acts worksData**: новая структура с явным указанием источника (`sourceType`, `sourceId`) вместо `workId`
- **API endpoints**: 
  - `GET /api/schedules/:id/source-info` — информация об источнике графика
  - `POST /api/schedules/:id/change-source` — смена источника с подтверждением
  - `POST /api/schedules/:id/bootstrap-from-estimate` — создание задач из позиций сметы (только ГЭСН/ФЕР/ТЕР)
- **Storage методы**: `changeScheduleSource()`, `bootstrapScheduleFromEstimate()`, `getEstimatePositionsByIds()`, хелпер `isMainEstimatePosition()`
- **UI**: 
  - Селектор источника на странице `/schedule`: **ВОР** или **Смета (выбор из списка импортированных смет)**
  - Кнопка «Сформировать акты» на странице графика
  - Диалог подтверждения смены источника с вводом "ПОДТВЕРЖДАЮ" (регистронезависимая проверка)
  - Автоматический bootstrap задач после смены источника (чтобы график сразу заполнялся)
  - **Вспомогательные позиции сметы** (ФСБЦ, прайс и т.д.): отображаются как подстроки под основными (ГЭСН/ФЕР/ТЕР), по умолчанию свёрнуты, доступны по кнопке-стрелке в левой колонке графика

### Изменено
- **Миграция БД**: `migrations/0006_schedule_estimate_source.sql` — расширение схемы графика и задач
- `shared/schema.ts`: новый тип `ActWorkItem` с явным `sourceType` + `sourceId`, обновлены `Schedule` и `ScheduleTask`
- `shared/schema.ts`: добавлена Zod-схема `actWorkItemSchema` для валидации
- `shared/routes.ts`: новые API-контракты для управления источником графика
- `server/storage.ts`: расширен интерфейс `IStorage` и класс `DatabaseStorage`
- `server/routes.ts`: генерация актов (`generateActs`) теперь ветвится по `schedule.sourceType` (works/estimate)
- `client/src/hooks/use-schedules.ts`: новые хуки `useScheduleSourceInfo()`, `useChangeScheduleSource()`, `useBootstrapScheduleFromEstimate()`, `useGenerateActsFromSchedule()`
- `client/src/pages/Schedule.tsx`: интеграция выбора источника и диалога подтверждения смены

### Исправлено
- Нет

### Примечания
- При смене источника все задачи графика удаляются, списки работ в актах очищаются (сами акты сохраняются)
- График строго привязан к одному источнику (ВОР или конкретная смета)
- Структура `acts.worksData` теперь универсальная и явно указывает источник каждой строки

---

## [2026-02-01] - UI: экран «Исходные» приведён к сценариям (карточки-разделы)
### Добавлено
- Sticky-блок текущего объекта на экране `/source-data`: «Объект: … ▾» + адрес одной строкой
- Горизонтальный скролл карточек «Стороны/участники» (заказчик/подрядчик/проектировщик)
- Баннер в карусели: «Ответственные лица» с открытием модального окна редактирования
- Карточки-разделы (не табы): «Материалы», «Документы качества», «Исполнительные схемы», «Протоколы/испытания» со счётчиками и CTA «Добавить»

### Изменено
- `client/src/pages/SourceData.tsx`: переработана компоновка “Исходных” под UX из `docs/RoadmapIsodnieDannie.md` (52–114)
- `client/src/pages/SourceData.tsx`: форма “Ответственные лица” перенесена в модальное окно, нижний список/формы удалены
- `client/src/components/materials/MaterialWizard.tsx`: синхронизация единиц измерения — ввод в “Ед. измерения” подставляется в “Ед.” партии (если поле партии пустое)

### Исправлено
- Нет

---

## [2026-02-01] - UI: «Материалы» — вертикальный скролл и кнопка «Назад к материалам»
### Добавлено
- Кнопка «Назад к материалам» на странице материала `/source/materials/:id`
- Действия на карточке материала: добавить партию и привязать документ качества к существующему материалу

### Изменено
- `client/src/pages/SourceMaterials.tsx`: скорректирован layout для корректного вертикального скролла списка
- `client/src/pages/SourceMaterialDetail.tsx`: добавлен элемент навигации “назад” и унифицирован scroll-layout
- `client/src/components/materials/BatchForm.tsx`: «Дата поставки» — ручной ввод `дд/мм/гггг` + выпадающий календарь (Popover/Calendar), с сохранением в ISO `YYYY-MM-DD`
- `client/src/components/materials/MaterialDetailView.tsx`: отображение даты поставки приведено к `дд/мм/гггг`
- `client/src/index.css`: добавлены недостающие CSS-переменные темы для `popover/*` и `card/*`, чтобы Radix overlay (Select/Calendar/Popover) имели непрозрачный фон
 - `client/src/components/materials/MaterialDetailView.tsx`: добавлены CTA «Добавить партию» и «Привязать документ»

### Исправлено
- Экран «Материалы» не прокручивался по вертикали на мобильных из-за некорректной связки `flex`/`ScrollArea`
- Нативное поле `type="date"` не позволяло зафиксировать формат `дд/мм/гггг` и UX выбора даты кликом для даты поставки
- Выпадающие списки (Select) и календари (Popover/Calendar) выглядели “прозрачными” из-за отсутствия CSS-переменных `--popover*`
- Нельзя было добавить новую партию/документ качества к уже созданному материалу (только через мастер создания)

---

## [2026-02-01] - Roadmap: исправления схемы БД для модуля "Исходные данные"
### Добавлено
- `docs/RoadmapIsodnieDannie.md`: детальная спецификация схемы БД с соблюдением правил rulesdb.mdc
- Раздел 2.6: добавлено поле `workId` в таблицу `act_material_usages` для связи материал ↔ работа
- Раздел 2.8: описание триггеров `set_updated_at()` для всех таблиц с `updated_at`
- Раздел 2.9: сводная таблица индексов для всех новых таблиц
- Раздел 8: детальное разрешение коллизии `attachments` vs `act_document_attachments` (выбран вариант "две таблицы")

### Изменено
- `docs/RoadmapIsodnieDannie.md`: унифицировано именование `objectId` вместо `projectId` (соответствие существующей схеме)
- Все таблицы: добавлены типы `bigint GENERATED ALWAYS AS IDENTITY` для `id`
- Все таблицы: добавлены `created_at` и `updated_at` (timestamptz) с триггерами
- Все FK: добавлены явные политики `ON DELETE` (cascade/restrict/setNull)
- Все статусы/типы: добавлены CHECK constraints
- `material_batches.quantity`: указан доменный масштаб `numeric(14,3)` вместо просто `numeric`
- `documents`: добавлены CHECK constraints для `doc_type`, `scope`, `valid_dates`
- `document_bindings`: добавлен CHECK constraint для обязательной привязки хотя бы к одной сущности
- API endpoints: `GET/POST /api/projects/:projectId/materials` → `GET/POST /api/objects/:objectId/materials`
- Storage методы: `listProjectMaterials(projectId)` → `listProjectMaterials(objectId)`

### Исправлено
- Несоответствие правилам rulesdb.mdc: отсутствие аудитных полей, CHECK constraints, индексов
- Потенциальная коллизия между существующей таблицей `attachments` и новой `act_document_attachments` (разрешена через разделение семантики)
- Отсутствие связи материал ↔ работа для п.3 АОСР "при выполнении работ применены"

---

## [2026-02-01] - Исходные данные: материалы и документы качества (MVP) + интеграция с АОСР
### Добавлено
- SQL-миграция `migrations/0005_materials_documents.sql`: 7 таблиц для материалов/поставок/документов и связи с актами (AOSR)
- API-контракты и серверные роуты для материалов/партии/документов/привязок и данных акта (п.3/приложения)
- UI: новые страницы `/source/materials`, `/source/materials/:id`, `/source/documents`
- UI: мастер добавления материала (4 шага) и базовая детальная карточка материала
- Экспорт PDF: сборка `p3MaterialsText` и `attachmentsText` из БД при экспорте акта (если поля не переопределены `formData`)

### Изменено
- `shared/schema.ts`: добавлены Drizzle-таблицы/типы для:
  - `materials_catalog`, `project_materials`, `material_batches`
  - `documents`, `document_bindings`
  - `act_material_usages`, `act_document_attachments`
- `client/src/pages/SourceData.tsx`: добавлены быстрые переходы в материалы и реестр документов качества
- `client/src/pages/Acts.tsx`: добавлен выбор материалов для п.3 АОСР и автоматическое формирование приложений на базе выбранных документов

### Исправлено
- `npm run check`: приведён в зелёное состояние после добавления нового модуля (типовые ошибки zod/insert-схем устранены)

---

## [2026-02-01] - Акты: вертикальная прокрутка в диалоге «Создать новый акт»
### Добавлено
- Нет

### Изменено
- `client/src/pages/Acts.tsx`: для диалога «Создать акты АОСР» добавлена вертикальная прокрутка — у `DialogContent` задан `overflow-hidden`, а область контента сделана `flex-1 min-h-0 overflow-y-auto`, чтобы в пределах `max-h-[90vh]` появлялся скролл при большом объёме данных

### Исправлено
- При большом объёме контента (шаблоны + форма АОСР) окошко «+Создать новый акт» не прокручивалось по вертикали

---

## [2026-01-31] - АОСР: исправление применения ультратонких линий 0.1pt
### Добавлено
- Нет

### Изменено
- `server/templates/aosr/aosr-template.json`: удалены все явные указания `border` и `borderColor` из ячеек таблиц (20+ полей), чтобы не переопределять кастомный layout "thinUnderline"
- `server/pdfGenerator.ts`: кастомные tableLayouts теперь передаются через `createPdfKitDocument(..., { tableLayouts })`, чтобы имя layout не игнорировалось node-версией pdfmake
- `server/templates/aosr/aosr-template.json`: таблицы подсказок под подписями переведены на `layout: "noBorders"` (там не должно быть подчёркиваний)
- `server/pdfGenerator.ts`: толщина линии в `thinUnderline` возвращена на 0.5pt (0.1pt визуально почти не виден)
- `server/pdfGenerator.ts`: добавлен layout `rowUnderline` для подчёркивания каждой строки таблицы
- `server/templates/aosr/aosr-template.json`: для пункта 5 “Даты” включён `layout: "rowUnderline"` (подчёркивание каждой строки)
- `server/pdfGenerator.ts`: `defaultBorder` включён в кастомных layout'ах, чтобы подчёркивания рисовались даже без явных `border` в ячейках (без рамок/вертикалей)

### Исправлено
- Кастомный layout "thinUnderline" с толщиной 0.1pt не применялся из-за явных `border: [false, false, false, true]` в ячейках таблиц
- Таблицы начинали отображаться рамками/сеткой из-за игнорирования кастомного layout и применения дефолтной разметки
- Теперь линии действительно ультратонкие (0.1pt)

---

## [2026-01-31] - АОСР: ультратонкие линии подчёркивания 0.1pt и выравнивание подсказок по центру
### Добавлено
- `server/pdfGenerator.ts`: кастомный layout "thinUnderline" с толщиной линии 0.1pt для всех подчёркиваний в бланковых полях

### Изменено
- `server/templates/aosr/aosr-template.json`: все таблицы с подчёркиваниями переведены на layout: "thinUnderline" (толщина линии 0.1pt вместо стандартной 1pt)
- `server/templates/aosr/aosr-template.json`: добавлено выравнивание по центру для стиля `hint` (alignment: "center")
- `server/pdfGenerator.ts`: толщина линии в layout "thinUnderline" уменьшена с 0.5pt до 0.1pt

### Исправлено
- Слишком толстые линии подчёркивания в бланковых полях
- Подсказки были выровнены по левому краю вместо центра

---

## [2026-01-31] - АОСР: минимизация межстрочных интервалов
### Добавлено
- Нет

### Изменено
- `server/templates/aosr/aosr-template.json`: уменьшен нижний отступ у стиля `hint` с 4 до 1 пункта для минимизации пробелов между hint-текстами и заголовками
- `server/templates/aosr/aosr-template.json`: уменьшен верхний отступ у стиля `sectionLabel` с 6 до 3 пунктов
- `server/templates/aosr/aosr-template.json`: убран перенос строки `\n` между словами "региональный" и "оператор:" в заголовке Застройщика

### Исправлено
- Слишком большие интервалы между hint-подсказками и последующими заголовками
- Неправильный перенос слова "оператор:" на новую строку

---

## [2026-01-31] - АОСР: финальная доработка отступов, линий и таблиц
### Добавлено
- Нет

### Изменено
- `server/templates/aosr/aosr-template.json`: скорректированы отступы вокруг заголовков "АКТ" и "освидетельствования скрытых работ" (margin: [0, 10, 0, 2] и [0, 0, 0, 4])
- `server/templates/aosr/aosr-template.json`: увеличен lineHeight с 1.05 до 1.1 для лучшей читаемости и соответствия эталону
- `server/templates/aosr/aosr-template.json`: все таблицы с подчёркиваниями переведены на layout: { "defaultBorder": false } вместо "noBorders" для единообразия
- `server/templates/aosr/aosr-template.json`: цвет линий подчёркивания изменён с #666666 на #000000 (чёрный) для всех бланковых полей
- `server/templates/aosr/aosr-template.json`: добавлен borderColor: "#000000" к ячейкам в таблицах № акта и количества экземпляров

### Исправлено
- Визуальное несоответствие между генерируемым PDF и эталоном `005_АОСР 4.pdf` по размерам шрифтов, выравниванию и линиям подчёркивания

---

## [2026-01-31] - АОСР: правки верстки шаблона под эталон (без изменения формата дат)
### Добавлено
- Нет

### Изменено
- `server/templates/aosr/aosr-template.json`: заголовок “Застройщик...” разбит на 2 строки (как в эталоне `005_АОСР 4.pdf`)
- `server/templates/aosr/aosr-template.json`: пункт 5 “Даты” — убрано тире и объединено “5. Даты:” + “начала работ ...” в одну строку через табличную раскладку (плейсхолдеры дат не менялись)
- `server/templates/aosr/aosr-template.json`: подсказки под подписями “(фамилия, инициалы) / (подпись)” переведены на таблицу для выравнивания как в бланке
- `server/templates/aosr/aosr-template.json`: `hint.fontSize` увеличен с 7 до 8 для более близкой читабельности к эталону

### Исправлено
- Нет

---

## [2026-01-30] - PDF: реквизиты организаций в АОСР (ИНН/ОГРН/юр.адрес/телефон)
### Добавлено
- Нет

### Изменено
- `server/pdfGenerator.ts`: форматирование `developerOrgFull/builderOrgFull/designerOrgFull` расширено реквизитами из “Исходных данных” (ИНН, КПП, ОГРН, юр.адрес, телефон/факс — если заполнены)
- `server/pdfGenerator.ts`: вывод реквизитов организаций приведён к “бланковому” виду — в несколько строк (удобнее читается в PDF)

### Исправлено
- Нет

---

## [2026-01-30] - ГЭСН: подготовка утилиты PDF → SQLite
### Добавлено
- `attached_assets/GESN/requirements.txt` — зависимости для парсера ГЭСН
- `attached_assets/GESN/README.md` — инструкции по запуску, логам и просмотру результатов

### Изменено
- `attached_assets/GESN/gesn_pdf_to_sqlite.py`: добавлены индексы SQLite, финальная статистика и обработка ошибок по страницам
- `attached_assets/GESN/gesn_pdf_to_sqlite.py`: добавлены запись `gesn_work_step` (состав работ) и режим `--dry-run`
- `attached_assets/GESN/gesn_pdf_to_sqlite.py`: относительные пути `--db/--log` теперь сохраняются рядом со скриптом (в папке `attached_assets/GESN/`)

### Исправлено
- Нет

---

## [2026-01-30] - UI: вкладка “Исходные данные” — корректная высота на мобильных
### Добавлено
- Кнопка “Заполнить тестовыми” на странице `/source-data` для быстрого заполнения всех полей демо‑значениями
- Реквизиты СРО для сторон (Заказчик/Подрядчик/Проектировщик): наименование СРО, ОГРН СРО, ИНН СРО
- DB: SQL-миграции (вариант B) — команда `npm run db:migrate` + документ `docs/db-migrations.md`

### Изменено
- `client/src/pages/SourceData.tsx`: переработана компоновка страницы под flex‑layout без “магических” расчётов высоты

### Исправлено
- Проблема с тем, что контент на вкладке “Исходные данные” не помещался по вертикали на мобильных из‑за `100vh`/фиксированного `calc(...)`
- После обновления страницы секции `Accordion` больше не раскрываются автоматически (по умолчанию всё свёрнуто)
- Исправлен сценарий, когда исходные данные объекта не подставлялись в акт при создании (актуально для новых актов без `objectId`)

## [2026-01-29] - Парсинг суммы количества ресурсов с учётом коэффициентов
### Добавлено
- Поле `quantityTotal` в тип `resources` парсера сметы (`client/src/lib/estimateParser.ts`)
- Колонка `quantity_total` в таблицу `position_resources` БД (`shared/schema.ts`)
- Миграция БД `migrations/0003_add_quantity_total.sql` для добавления новой колонки
- Поддержка парсинга колонки "всего с учётом коэффициентов" из Excel-выгрузки ГРАНД-Сметы

### Изменено
- `estimateParser.ts`: обновлена функция `detectColumns()` для поиска колонки суммы количества
- `estimateParser.ts`: обновлён парсинг ресурсов для чтения значения `quantityTotal`
- `shared/routes.ts`: добавлена валидация поля `quantityTotal` в схему импорта ресурсов

### Описание
Теперь при импорте сметы для каждого ресурса сохраняются два значения количества:
- `quantity` — норматив на единицу измерения (колонка 5 в сметах)
- `quantityTotal` — сумма с учётом коэффициентов (колонка 7 в сметах)

---

## [2026-01-29] - Смета (ЛСР): импорт, хранение и просмотр на вкладке ВОР
### Добавлено
- DB: таблицы сметы `estimates`, `estimate_sections`, `estimate_positions`, `position_resources` + SQL-миграция `migrations/0002_estimates.sql`
- API: ресурс `estimates` — `GET /api/estimates`, `GET /api/estimates/:id`, `POST /api/estimates/import`, `DELETE /api/estimates/:id`
- UI: переключение “Работы (ВОР) / Смета” на странице `/works`, импорт `.xlsx` сметы и просмотр разделов/позиций/ресурсов
- Парсер: `client/src/lib/estimateParser.ts` (выгрузка ГРАНД‑Сметы: поиск строки заголовка, разбор позиций/ресурсов, пропуск служебных строк)

### Изменено
- `shared/schema.ts`: добавлены типы/insert-схемы для сметы
- `shared/routes.ts`: добавлен контракт `api.estimates`
- `server/storage.ts`: добавлены операции импорта/получения/удаления смет
- `server/routes.ts`: добавлены API-роуты сметы
- `server/index.ts`: увеличен лимит body-parser до 10mb для импорта больших смет

### Исправлено
- Ошибка "request entity too large" при импорте ЛСР с большим количеством ресурсов (увеличен лимит `express.json` и `express.urlencoded` до 10mb)

---

## [2026-01-27] - MVP: объект строительства и исходные данные
### Добавлено
- DB: таблицы `objects`, `object_parties`, `object_responsible_persons` + связь `acts.object_id` (подготовка к multi-object в будущем)
- API (MVP current object): `GET/PATCH /api/object/current`, `GET/PUT /api/object/current/source-data`
- PDF: сборка плейсхолдеров из исходных данных объекта при `POST /api/acts/:id/export` (приоритет: formData overrides → object source data)
- UI: новая вкладка “Исходные” (`/source-data`) с анкетой (Accordion) и сохранением

### Изменено
- Навигация: “Главная” убрана из `BottomNav` и перенесена в кнопку в правом верхнем углу `Header`
- `Header`: в бургер-меню отображается текущий объект

### Исправлено
- Нет

---

## [2026-01-26] - Настройка базы данных и автозапуск
### Добавлено
- Документация по настройке после перезагрузки системы (`docs/setup-after-reboot.md`)
- Скрипт быстрого запуска приложения `start-dev.sh` с автоматическими проверками PostgreSQL и БД
- Алиас `tjr-dev` для быстрого запуска из любой директории
- Краткая шпаргалка по запуску (`QUICKSTART.md`)
- SQL скрипт для создания пользователя и БД (`setup-db-commands.sql`)

### Изменено
- Обновлён `README.md` с информацией о быстром старте

### Исправлено
- Настроена база данных PostgreSQL: создан пользователь `app` и база `telegram_jurnal_rabot`
- Применена схема базы данных через `npm run db:push`
- Исправлены ошибки подключения к БД (ECONNREFUSED, password authentication failed)

---

## [2026-01-26] - Исправление ошибок импорта Excel
### Добавлено
- Улучшенное логирование процесса импорта: подсчет пропущенных строк и предупреждения о строках с пустыми обязательными полями (`client/src/pages/Works.tsx`)
- Обработка ошибок чтения Excel файла: проверка на поврежденные файлы, отсутствие листов и ошибки парсинга (`client/src/pages/Works.tsx`)

### Изменено
- Нижняя навигация `BottomNav`: изменён порядок вкладок (ВОР → График работ → Главная → Акты → ЖР) (`client/src/components/BottomNav.tsx`)
- Документация фронтенда: в структуру страниц добавлен `/schedule` (`docs/frontend.md`)

### Исправлено
- **Критическая ошибка**: добавлена проверка на пустое поле `unit` при импорте Excel. Поле `unit` является обязательным (`notNull` в схеме БД), но ранее не проверялось, что приводило к ошибкам валидации на сервере (`client/src/pages/Works.tsx`)
- **Ошибка валидации**: исправлена обработка `quantityTotal` - теперь для пустых значений передается `null` вместо пустой строки, что соответствует типу `numeric` в схеме БД (`client/src/pages/Works.tsx`)

---

## [2026-01-25] - Исправление ошибок TypeScript в server/replit_integrations/*
### Добавлено
- Нет

### Изменено
- Нет

### Исправлено
- Импорт `AbortError` в `server/replit_integrations/batch/utils.ts`: заменён `pRetry.AbortError` на прямой импорт `AbortError` из `p-retry`
- Импорт схемы чата в `server/replit_integrations/chat/storage.ts`: изменён импорт с `@shared/schema` на `@shared/models/chat` для корректного доступа к таблицам `conversations` и `messages` с полями `conversationId`, `role`, `content`
- Проверки на `response.data` в `server/replit_integrations/image/client.ts`: добавлены проверки на существование данных перед использованием
- Проверки на `response.data` в `server/replit_integrations/image/routes.ts`: добавлена проверка и обработка ошибки при отсутствии данных

---

## [2026-01-25] - UI: исправление заголовка колонки в графике работ
### Добавлено
- Нет

### Изменено
- Нет

### Исправлено
- Заголовок колонки в таблице "График работ" изменён с "Работа" на "Наименование работ" (`client/src/lib/i18n.ts`)

---

## [2026-01-25] - Акты: формирование из графика работ (actNumber)
### Добавлено
- Поле принадлежности задачи к акту: `schedule_tasks.act_number` (nullable) + индекс `(schedule_id, act_number)` (`shared/schema.ts`)
- Глобальный номер акта: `acts.act_number` (unique, nullable для legacy) (`shared/schema.ts`)
- API: `POST /api/schedules/:id/generate-acts` — сформировать/обновить акты из графика (`shared/routes.ts`, `server/routes.ts`)
- UI графика `/schedule`: отображение и редактирование номера акта у задачи (`client/src/pages/Schedule.tsx`)
- UI актов `/acts`: кнопка “Сформировать/обновить из графика” (`client/src/pages/Acts.tsx`)
- UI актов `/acts`: кнопка “Скачать” экспортирует PDF даже без выбора шаблонов (fallback к одному PDF по `worksData`)

### Изменено
- Расчёт периода акта: `dateStart=min(startDate)`, `dateEnd=max(startDate+durationDays)`; `worksData` агрегируется по `workId`, quantity берётся из `works.quantityTotal` (`server/routes.ts`)
- Экспорт PDF: дефолт `actNumber` берётся из `act.actNumber`, а дефолт `actDate` — из `act.dateEnd` (`server/routes.ts`)

### Исправлено
- Нет

---

## [2026-01-25] - АОСР: приведение шаблона к эталону `005_АОСР 4.pdf`
### Добавлено
- Планируемые плейсхолдеры и секции под эталонную форму АОСР (расширение модели `ActData`, новые роли/подписи, приложения)

### Изменено
- Будет обновлён `server/templates/aosr/aosr-template.json`: материалы и приложения — **текстом** (как в эталоне), без таблицы “Наименование”
- Будет подключён шрифт **Times New Roman** для максимально близкого визуального совпадения

### Исправлено
- Нет

---

## [2026-01-24] - АОСР: генерация PDF по JSON-шаблону (pdfmake)
### Добавлено
- `server/templates/aosr/aosr-template.json` используется как источник `docDefinition` для pdfmake (шаблон с плейсхолдерами `{{...}}`)
- Рекурсивная подстановка плейсхолдеров и инжект строк таблицы материалов при генерации PDF

### Изменено
- `server/pdfGenerator.ts`: генерация АОСР переведена с хардкода на загрузку/кэширование JSON-шаблона

### Исправлено
- Нет

---

## [2026-01-17] - Schedule (Гант): сущности, API и рабочий экран
### Добавлено
- Таблицы `schedules` и `schedule_tasks` в `shared/schema.ts` (типизация + insert-схемы + индексы)
- API графика работ в `shared/routes.ts`: default/get/create/bootstrap-from-works + patch задачи
- Реализация schedule-роутов и storage в `server/routes.ts`/`server/storage.ts` (идемпотентный bootstrap из ВОР)
- Хуки `client/src/hooks/use-schedules.ts` (React Query)
- Рабочий экран `/schedule`: empty-state, bootstrap из ВОР, отрисовка Ганта, редактирование через диалог и сдвиг кнопками (-1/+1 день)

### Изменено
- `docs/project.md`: актуализированы сущности БД и список API-ресурсов (schedule)
- `docs/tasktracker.md`: обновлён статус шагов P1-4
- `client/src/lib/i18n.ts`: расширены строки для экрана “График работ”

### Исправлено
- Нет

---

## [2026-01-17] - UI: перенос “Настройки” в меню и добавление “График работ”
### Добавлено
- Страница `/schedule` (плейсхолдер) — “График работ”
- Выпадающее меню “гамбургера” в `Header` с пунктом “Настройки”

### Изменено
- Нижняя навигация `BottomNav`: “Настройки” заменены на “График работ”
- Нижняя навигация `BottomNav`: изменён порядок вкладок (ВОР → ЖР → Главная → График работ → Акты)
- `docs/project.md`: актуализирован список страниц и описание навигации

### Исправлено
- Нет

---

## [2026-01-17] - Документация фронтенда и UI
### Добавлено
- `/docs/frontend.md` — подробное описание архитектуры фронтенда, UI-системы, компонентов и паттернов разработки

### Изменено
- Нет

### Исправлено
- Нет

---

## [2026-01-17] - Документация: чеклист пуша на GitHub
### Добавлено
- `.cursor/rules/github-push.mdc` — инструкции для безопасного пуша на GitHub (проверка больших файлов, диагностика remotes)

### Изменено
- `.gitignore`: разрешено отслеживание `.cursor/rules/github-push.mdc` при общем игноре `.cursor/`

### Исправлено
- Нет

---

## [2026-01-11] - Создание ветки для документации проекта на GitHub
### Добавлено
- Ветка `preparation-of-project-documentation-in-cursor` создана на GitHub
- Обновлен `.gitignore` — добавлено исключение для `.cursor/`

### Изменено
- Нет

### Исправлено
- Нет

---

## [2026-01-11] - P0: синхронизация обработки сообщений (messages/:id/process)
### Добавлено
- Серверный эндпоинт `POST /api/messages/:id/process` (синхронизация с `shared/routes.ts`)

### Изменено
- `server/routes.ts`: вынесена общая функция AI-нормализации сообщений и переиспользована в `create` и `process`
- `/docs/project.md`: актуализирован статус эндпоинта `messages/:id/process`

### Исправлено
- Нет

---

## [2026-01-11] - P0-2: безопасный импорт ВОР (bulk, без авто-удаления)
### Добавлено
- `POST /api/works/import` — bulk импорт позиций ВОР (режим `merge`/`replace`, по умолчанию безопасный `merge`)

### Изменено
- `client/src/pages/Works.tsx`: импорт Excel больше не вызывает `DELETE /api/works`, вместо этого отправляет один bulk-запрос
- `client/src/hooks/use-works.ts`: добавлен хук `useImportWorks`
- `server/storage.ts`: добавлен метод `importWorks` (merge/replace)
- `shared/routes.ts`: расширен API-контракт для импорта `works/import`
- `/docs/project.md`: актуализирован сценарий импорта

### Исправлено
- Исправлено преждевременное снятие флага “импортируется” (теперь импорт ожидает завершения чтения файла и bulk-запроса)

---

## [2026-01-11] - P0-3: защита удаления ВОР (dev-only)
### Добавлено
- Ограничение на `DELETE /api/works`: в production эндпоинт отключён (404)

### Изменено
- `/docs/project.md`: добавлено примечание про деструктивный debug-эндпоинт

### Исправлено
- Нет

---

## [2026-01-17] - P0-4: dev-only сидирование (opt-in)
### Добавлено
- `ENABLE_DEMO_SEED=true` — флаг для включения сидирования демо-данных в dev

### Изменено
- `server/routes.ts`: сидирование демо-работ выполняется только в dev и только при явном флаге `ENABLE_DEMO_SEED=true`
- `/docs/project.md`: добавлено описание переменной `ENABLE_DEMO_SEED`

### Исправлено
- Убрано безусловное сидирование при старте сервера

---

## [2026-03-01] - Мультипровайдерная аутентификация: Этап 2 (Auth-сервис и API)
### Добавлено
- `server/auth-service.ts` — центральный сервис аутентификации с методами:
  - `hashPassword/verifyPassword` — bcrypt с cost factor 12
  - `generateJWT/verifyJWT` — JWT токены (HS256, TTL 7 дней)
  - `findOrCreateUserByProvider` — унификация пользователей из разных провайдеров
  - `validateTelegramAuthDate` — проверка свежести Telegram initData (< 600 сек)
- `server/middleware/auth.ts` — unified middleware с поддержкой:
  - JWT токенов через `Authorization: Bearer`
  - Telegram initData через `X-Telegram-Init-Data`
  - Legacy browser token через `X-App-Access-Token` (для обратной совместимости)
- `server/routes/auth.ts` — новые auth endpoints:
  - `POST /api/auth/login/telegram` — вход через Telegram → JWT
  - `POST /api/auth/register` — регистрация по email/паролю → JWT
  - `POST /api/auth/login` — вход по email/паролю → JWT
  - `GET /api/auth/me` — информация о текущем пользователе
  - `POST /api/auth/link-provider` — привязка дополнительного провайдера
- Rate limiting на auth endpoints:
  - `/login` — 5 попыток/мин на IP
  - `/register` — 3 попытки/час на IP
- Зависимости: `bcryptjs`, `jose` (для JWT)

### Изменено
- `server/middleware/telegramAuth.ts` — интегрирован с auth-service:
  - Добавлена проверка `auth_date` (replay protection)
  - Вызов `authService.findOrCreateUserByProvider` для создания/поиска пользователя
  - Установка `req.user` (unified интерфейс) в дополнение к `req.telegramUser`
- `shared/routes.ts` — добавлены контракты для auth API (Zod схемы)
- `server/routes.ts` — подключение `registerAuthRoutes(app)`

### Безопасность
- Пароли хешируются через bcrypt (rounds=12)
- JWT подписываются секретом из env `JWT_SECRET` (обязателен в production)
- Telegram auth_date проверяется на свежесть (защита от replay атак)
- Rate limiting защищает от bruteforce атак
- Блокировка пользователей (`users.isBlocked`)

---

## [2026-02-20] - Интеграция Telegram MiniApp: Применение темы Telegram к UI
### Добавлено
- `client/src/components/TelegramThemeProvider.tsx` — провайдер для автоматического применения темы Telegram к приложению
  - Автоматически устанавливает CSS-переменные Telegram (`--tg-theme-bg-color`, `--tg-theme-text-color`, `--tg-theme-button-color` и др.)
  - Автоматически переключает класс `dark`/`light` на основе `colorScheme` из Telegram
  - Реагирует на изменения темы в реальном времени
- Утилитарные CSS-классы для работы с темой Telegram: `.tg-bg`, `.tg-text`, `.tg-hint`, `.tg-link`, `.tg-button`, `.tg-secondary-bg`, `.tg-accent`, `.tg-destructive`

### Изменено
- `client/src/index.css` — добавлены CSS-переменные Telegram с дефолтными значениями
- `client/src/index.css` — обновлены базовые стили для использования переменных Telegram (`body`, `h1-h6`, `a`, `button`)
- `client/src/App.tsx` — интегрирован `TelegramThemeProvider` в дерево компонентов

### Исправлено
- Нет

---

## [2026-02-20] - Интеграция Telegram MiniApp: TypeScript типы и хук useTelegram
### Добавлено
- `client/src/types/telegram.d.ts` — полные TypeScript типы для Telegram WebApp API (TelegramWebApp, TelegramWebAppUser, TelegramWebAppThemeParams, MainButton, BackButton, HapticFeedback и др.)
- `client/src/hooks/useTelegram.ts` — React хук для работы с Telegram WebApp API
  - Предоставляет доступ к WebApp, user, initData, themeParams, colorScheme
  - Обрабатывает случай запуска вне Telegram (mock данные для разработки)
  - Дополнительные хелперы: `useTelegramUser()`, `useTelegramTheme()`
  - Автоматическая подписка на события изменения темы и viewport

### Изменено
- Нет

### Исправлено
- Нет

---

## [2026-01-17] - Документация: правила работы ассистента в Cursor
### Добавлено
- `/docs/cursor-assistant-rules.md` — публичные правила разработки и документирования (перенесены из `.cursor/skills/cursorrules/SKILL.md`)

### Изменено
- `/docs/project.md`: добавлена ссылка на правила ассистента

### Исправлено
- Нет

## [2026-01-11] - Документация проекта и идеи улучшений
### Добавлено
- `/docs/project.md` — описание проекта (назначение, архитектура, структура, БД, API, env, команды)
- `/docs/improvements.md` — перечень улучшений/расширений с приоритетами
- `/docs/tasktracker.md` — трекер задач (старт)

### Изменено
- Нет

### Исправлено
- Нет

