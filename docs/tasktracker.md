# Task Tracker

---

## Задача: Импорт материалов из PDF-счетов поставщиков (Invoice Import)
- **Статус**: Завершена
- **Описание**: Реализован полный функционал импорта материалов из PDF-счётов поставщиков через микросервис invoice-extractor. Трёхфазная реализация: инфраструктура, backend API, frontend UI.
- **Этапы реализации**:
  - [x] **Фаза 1: Инфраструктура (INV-001, INV-002)**
    - [x] INV-001: Реструктуризация сервиса `services/invoice-extractor/` в правильный Python-пакет с app/
    - [x] INV-002: Docker Compose сервис для invoice-extractor с healthcheck на 5050:5000
  - [x] **Фаза 2: Backend API (INV-003 до INV-006)**
    - [x] INV-003: Zod-схемы в `shared/routes.ts` для parseInvoice и bulkCreate endpoints
    - [x] INV-004: `bulkCreateProjectMaterials()` в `server/storage.ts` с дедупликацией case-insensitive
    - [x] INV-005: Эндпоинт `POST /api/parse-invoice` с multer, FormData proxy, SSRF-защита, rate-limiting (10 req/min)
    - [x] INV-006: Эндпоинт `POST /api/bulk-create-materials` для массового создания материалов
  - [x] **Фаза 3: Frontend (INV-007 до INV-009)**
    - [x] INV-007: Хуки `useParseInvoice()` и `useBulkCreateMaterials()` в `client/src/hooks/use-materials.ts`
    - [x] INV-008: `InvoicePreviewDialog.tsx` с таблицей, чекбоксами, inline-редактированием, итогом
    - [x] INV-009: `InvoiceImportButton.tsx` и интеграция в `SourceMaterials.tsx` (видна только на вкладке "Локальные")
- **Файлы**:
  - Инфраструктура: `services/invoice-extractor/`, `docker-compose.yml`
  - Backend: `server/routes.ts`, `server/storage.ts`
  - Frontend: `client/src/hooks/use-materials.ts`, `client/src/components/materials/InvoiceImportButton.tsx`, `client/src/components/materials/InvoicePreviewDialog.tsx`
  - Shared: `shared/routes.ts`
  - Env: `INVOICE_EXTRACTOR_URL` (default: `http://localhost:5050`)
- **Зависимости**: multer, express-rate-limit
- **Документация**: `docs/changelog.md`, `docs/project.md` (обновлены)

---

## Задача: Массовый импорт материалов из Excel
- **Статус**: Завершена
- **Описание**: Реализован функционал массового импорта справочника материалов в глобальный каталог из Excel-файла через админ-панель. Администраторы могут загружать материалы с дедупликацией по названию (case-insensitive).
- **Шаги выполнения**:
  - [x] IMPORT-001: Создать парсер Excel `client/src/lib/materialsParser.ts` с валидацией
  - [x] IMPORT-002: Backend API `POST /api/admin/materials-catalog/import` с транзакционной обработкой
  - [x] IMPORT-003: Хук React Query `useAdminImportMaterials()` в `client/src/hooks/use-admin.ts`
  - [x] IMPORT-004: UI кнопка импорта в `AdminMaterials.tsx` с file input
  - [x] IMPORT-005: Валидация на клиенте (размер ≤10MB, формат .xlsx/.xls)
  - [x] IMPORT-006: Валидация на сервере (Zod-схемы, длина названия ≤500)
  - [x] IMPORT-007: Дедупликация по названию (case-insensitive) в режиме merge
  - [x] IMPORT-008: Статистика импорта (получено/создано/обновлено/пропущено)
  - [x] IMPORT-009: Документация `docs/materials-import-guide.md`
  - [x] IMPORT-010: Обновление `docs/project.md` и `docs/changelog.md`
- **Файлы**:
  - Клиент: `client/src/lib/materialsParser.ts`, `client/src/hooks/use-admin.ts`, `client/src/pages/admin/AdminMaterials.tsx`
  - Сервер: `server/storage.ts`, `server/routes.ts`, `server/middleware/adminAuth.ts`
  - Shared: `shared/routes.ts`
  - Документация: `docs/materials-import-guide.md`, `docs/project.md`, `docs/changelog.md`, `docs/tasktracker.md`
- **Зависимости**: Admin Panel (завершена), Excel парсер (использован существующий `xlsx` пакет)

---

## Задача: График работ — UX-исправления диалога «Редактирование задачи»
- **Статус**: Завершена
- **Описание**: 4 UX-проблемы в диалоге «Редактирование задачи» на вкладке «График работ».
- **Шаги выполнения**:
  - [x] FIX-1: Кнопки Сохранить/Отмена в один горизонтальный ряд (div flex-row)
  - [x] FIX-2: Поле «Длительность» — позволяет очистить и ввести новое число
  - [x] FIX-3: После Save — диалог остаётся открытым, toast «Сохранено»
  - [x] FIX-4: Возврат из SelectTaskMaterials — диалог переоткрывается (sessionStorage)
  - [x] Bug fix: Кнопка «Отмена» явно сбрасывает selectedTask
  - [x] Bug fix: openEditRef null-check с fallback на pending queue
  - [x] Build ✓, Reviewer ✓
- **Зависимости**: `client/src/pages/Schedule.tsx`

---

## Задача: График работ — стабильность диалога «Редактирование задачи» на мобильных
- **Статус**: Завершена
- **Описание**: Исправить нестабильность окна «Редактирование задачи» на вкладке «График работ» при использовании на телефоне: диалог «ездит» влево-вправо при свайпе; клавиатура появляется сразу при открытии вместо явного клика по полю.
- **Шаги выполнения**:
  - [x] UI-001: Отключить автофокус при открытии — `onOpenAutoFocus={(e) => e.preventDefault()}` в DialogContent
  - [x] UI-002: Добавить touch-pan-y, overscroll-contain, overflow-x-hidden на контейнер и скролл-область диалога
  - [x] touch-none на overlay в dialog.tsx для блокировки свайпов фона
  - [x] Документация (changelog.md, tasktracker.md)
- **Зависимости**: `client/src/pages/Schedule.tsx`, `client/src/components/ui/dialog.tsx`

---

## Задача: График работ — управление материалами задачи через отдельный экран
- **Статус**: Завершена
- **Описание**: Создать отдельный полноэкранный экран для управления материалами задачи графика (аналогично SelectActTemplate), заменив встроенный компонент TaskMaterialsEditor в диалоге редактирования задачи на кнопку перехода.
- **Шаги выполнения**:
  - [x] MAT-001: Создать страницу SelectTaskMaterials.tsx с автосохранением (debounce 500ms)
  - [x] MAT-002: Добавить маршрут `/select-task-materials` в App.tsx
  - [x] MAT-003: Заменить TaskMaterialsEditor на кнопку в Schedule.tsx
  - [x] MAT-004: Добавить переводы в i18n (ru/en)
  - [x] MAT-005: Обновить документацию (changelog.md, tasktracker.md)
  - [x] Проверить TypeScript и выполнить build
- **Зависимости**: `client/src/pages/Schedule.tsx`, `client/src/pages/SelectTaskMaterials.tsx`, `client/src/App.tsx`, `client/src/lib/i18n.ts`, wouter, хуки useTaskMaterials и useReplaceTaskMaterials

---

## Задача: График работ — выбор типа акта через отдельный экран
- **Статус**: Завершена
- **Описание**: Заменить выпадающий Popover с типами актов на кнопку, которая открывает полноэкранную страницу выбора типа акта с поиском и группировкой по категориям.
- **Шаги выполнения**:
  - [x] Создать новый компонент страницы `SelectActTemplate.tsx` для выбора типа акта
  - [x] Добавить роут `/select-act-template` в `App.tsx`
  - [x] Заменить Popover на кнопку в `Schedule.tsx`, которая открывает новую страницу
  - [x] Реализовать логику возврата с результатом выбора из `SelectActTemplate`
  - [x] Обработать результат выбора в `Schedule.tsx` через `history.state`
  - [x] Добавить переводы для новой страницы в `i18n`
  - [x] Протестировать навигацию и передачу данных (TypeScript check + build)
  - [x] Обновить документацию (`docs/changelog.md`, `docs/tasktracker.md`)
- **Зависимости**: `client/src/pages/Schedule.tsx`, `client/src/pages/SelectActTemplate.tsx`, `client/src/App.tsx`, `client/src/lib/i18n.ts`, wouter

---

## Задача: Schedule — вместо статусов показывать «акт N · ТЗ · БРГ»
- **Статус**: Завершена
- **Описание**: На экране `/schedule` убрать статусы «ПРИНЯТО/В РАБОТЕ». Вместо них показывать строку `акт N · X ч · Y чел`, где `N` — номер назначенного акта (или `-`), `X` — трудозатраты ТЗ из сметы (если нет — `0`), `Y` — перспективное число людей БРГ (пока `0`).
- **Шаги выполнения**:
  - [x] Найти место рендера статуса в строке задачи (`client/src/pages/Schedule.tsx`)
  - [x] Подключить расчёт ТЗ из позиции сметы (ресурсы ОТ/ОТМ; если нет данных — `0`)
  - [x] Заменить статус на строку `акт N · X ч · 0 чел`
  - [x] Прогнать `npm run check` и `npm run build`
  - [x] Обновить документацию (`docs/changelog.md`, `docs/tasktracker.md`)
- **Зависимости**: `client/src/pages/Schedule.tsx`, данные ресурсов позиций сметы (`estimates.get`)

---

## Задача: Schedule — поле «Номер акта» должно редактироваться на iOS
- **Статус**: Завершена
- **Описание**: В диалоге «Редактирование задачи» поле «Номер акта» в Telegram iOS WebView не позволяло удалить цифру и ввести новую из-за `input type="number"` в контролируемом инпуте.
- **Шаги выполнения**:
  - [x] Найти поле «Номер акта» в форме редактирования задачи (`client/src/pages/Schedule.tsx`)
  - [x] Заменить `type="number"` на `type="text"` + `inputMode="numeric"` и фильтраровать ввод до цифр, сохранив валидацию при сохранении
  - [x] Проверить линтер для изменённого файла
  - [x] Обновить документацию (`docs/changelog.md`, `docs/tasktracker.md`)
- **Зависимости**: `client/src/pages/Schedule.tsx`

---

## Задача: Исходные данные — поднять наименование объекта максимально вверх
- **Статус**: Завершена
- **Описание**: На экране `/source-data` строка «Объект: …» визуально располагалась ниже блока «Стороны/участники». Требуется закрепить селектор объекта максимально сверху и всегда показывать его выше остального контента.
- **Шаги выполнения**:
  - [x] Найти страницу и место рендера селектора объекта (`client/src/pages/SourceData.tsx`)
  - [x] Вынести селектор объекта и адрес из `ScrollArea` и закрепить под `Header`
  - [x] Удалить демо-заполнение (кнопка «Тестовые данные» и тестовые данные)
  - [x] Проверить линтер для изменённого файла
  - [x] Обновить документацию (`docs/changelog.md`, `docs/tasktracker.md`)
- **Зависимости**: `client/src/pages/SourceData.tsx`, `client/src/components/Header.tsx`

---

## Задача: WorkLog — таблицы Разделов 1/2/4: горизонтальный скролл + подсказки; табы: крупнее и очевиднее прокрутка
- **Статус**: Завершена
- **Описание**: На мобильных таблицы «Раздел 1/2/4» не помещались по ширине и прокрутка была неочевидна. Требуется сделать горизонтальный скролл таблиц более понятным и увеличить плашки в карусели вкладок.
- **Шаги выполнения**:
  - [x] Увеличить размеры плашек табов в карусели и добавить визуальную подсказку горизонтальной прокрутки
  - [x] Для таблиц Разделов 1/2/4 добавить явный хинт «листайте влево/вправо» и индикаторы скролла (градиентные края)
  - [x] Усилить горизонтальный скролл таблиц под touch (touch-pan-x + min-width)
- **Зависимости**: `client/src/pages/WorkLog.tsx`

---

## Задача: Акты — кнопка «Скачать» должна сохранять PDF в Telegram
- **Статус**: Завершена
- **Описание**: В Telegram MiniApp (особенно iOS WebView) `window.open()` открывает PDF как предпросмотр и часто не предлагает сохранить файл. Нужно инициировать скачивание (attachment) и использовать Telegram WebApp API для открытия ссылки во внешнем браузере.
- **Шаги выполнения**:
  - [x] Backend: добавить `?download=1` для `/api/pdfs/:filename` и отдавать `Content-Disposition: attachment`
  - [x] Backend: добавить валидацию `filename` (защита от path traversal) и ограничение на `.pdf`
  - [x] Frontend: заменить `window.open()` на `Telegram.WebApp.openLink()` (если доступно) + fallback на `<a download>`
  - [x] Проверить TypeScript (`npm run check`)
- **Зависимости**: `client/src/pages/Acts.tsx`, `server/routes.ts`, Telegram WebApp (`window.Telegram.WebApp.openLink`)

---

## Задача: UI — читаемый текст на кнопках (ВОР и График работ)
- **Статус**: Завершена
- **Описание**: Исправить нечитабельный/тёмный текст на некоторых кнопках на страницах `/works` и `/schedule` в Telegram MiniApp, сохранив корректные стили для primary/filled.
- **Шаги выполнения**:
  - [x] Убрать глобальную стилизацию всех `<button>` под Telegram-тему (ограничить стили явными классами/компонентами)
  - [x] `/works`: перевести segmented tabs на общий `Button`, чтобы фон/цвета управлялись вариантом компонента
  - [x] `/schedule`: перевести pill-фильтры на общий `Button` и применить `buttonVariants` для залитых элементов таймлайна
  - [x] Прогнать `npm run check` (TypeScript)
- **Зависимости**: `client/src/index.css`, `client/src/pages/Works.tsx`, `client/src/pages/Schedule.tsx`, `client/src/components/ui/button.tsx`

---

## Задача: MVP — изоляция данных пользователя и UX-доработки
- **Статус**: Завершена
- **Описание**: Устранение критических пробелов MVP: привязка журнала к Telegram userId, изоляция данных по пользователю и объекту на сервере, фильтры на /schedule, onboarding-баннер
- **Шаги выполнения**:
  - [x] MVP-001: Заменить hardcoded `"user_123"` на `useTelegram().user.id` в `Home.tsx`
  - [x] MVP-002: Серверная фильтрация `GET/POST/PATCH /api/messages` и `/worklog/section3` по userId через `telegramAuthMiddleware`
  - [x] MVP-003: SQL-миграция `0013` — поле `object_id` в таблице `messages`, заполняется при создании из текущего объекта пользователя
  - [x] MVP-004: Pill-фильтры «Все / С актом / Без акта» на `/schedule` вместо заглушки «Фильтры»
  - [x] MVP-005: Onboarding-баннер «С чего начать?» на главной странице
- **Зависимости**: Telegram MiniApp Integration (завершена)

---

## Задача: Admin Panel — Панель администратора
- **Статус**: Завершена
- **Описание**: Реализована минимальная административная панель для управления пользователями, мониторинга системы, очереди AI-обработки и глобального справочника материалов.
- **Шаги выполнения**:
  - [x] **ADMIN-001**: SQL-миграция `0014_admin_panel.sql` — таблица `admin_users` + `is_blocked` в `objects`
  - [x] **ADMIN-002**: Middleware `requireAdmin` (`server/middleware/adminAuth.ts`)
  - [x] **ADMIN-003**: Admin API — users, stats, messages queue (11 эндпоинтов)
  - [x] **ADMIN-004**: Admin API — materials catalog CRUD (POST/PATCH/DELETE /api/admin/materials-catalog)
  - [x] **ADMIN-005**: Frontend — `AdminLayout.tsx` + роуты в `App.tsx` + хуки `use-admin.ts`
  - [x] **ADMIN-006**: Frontend — `AdminUsers.tsx` (список, блокировка, назначение admin)
  - [x] **ADMIN-007**: Frontend — `AdminDashboard.tsx` + `AdminMessages.tsx`
  - [x] **ADMIN-008**: Frontend — `AdminMaterials.tsx` (CRUD глобального каталога)
  - [x] Code review + исправление 7 найденных проблем (N+1, try/catch, типы, security)
- **Зависимости**: `shared/schema.ts`, `server/storage.ts`, `server/routes.ts`, `client/src/App.tsx`

---

## Задача: UI Redesign — приведение интерфейса к референсу Visily
- **Статус**: В процессе
- **Описание**: Полное приведение всех экранов приложения к дизайн-референсу из `/docs/Visily-Export_23-02-2026_08-45-27/`. Цель — pixel-perfect соответствие макетам по компонентам, цветам, типографике и поведению.
- **Шаги выполнения**:
  - [x] **Шаг 1**: Header (вариативный) + BottomNav (иконки/лейблы/активный стейт по макету)
  - [x] **Шаг 2**: Home `/` — чат-UI + AI-карточка "РАБОТА УСПЕШНО СОПОСТАВЛЕНА" + инпут
  - [x] **Шаг 3**: Works `/works` — карточный список ВОР + зона импорта Excel + segmented tabs
  - [x] **Шаг 4**: Schedule `/schedule` — верхний блок "Источник данных" + CTA "Сформировать акты" + табличный вид задач
  - [x] **Шаг 5**: SourceData + SourceMaterials + SourceDocuments — стиль дашборда "Energosnab"
  - [x] **Шаг 6**: Settings — профиль, секции настроек, тумблеры, кнопка "Выйти"
  - [x] **Шаг 7**: WorkLog `/worklog` — список записей (дата/статус/объём) + CTA «Добавить новую запись» + «Общий прогресс» (без FAB «+»)
- **Зависимости**: нет внешних; шаг 1 — блокирует остальные (Header/BottomNav используются везде)

---

## Задача: Bootstrap-миграция для пустой БД
- **Статус**: Завершена
- **Описание**: `npm run db:migrate` должен полностью поднимать схему на чистой БД без ошибок. Проблема: таблицы `works`, `acts` и другие создавались через `drizzle-kit push`, но ни в одной миграции не были созданы — последующие миграции ссылались на них через FK.
- **Шаги выполнения**:
  - [x] Проанализировать все миграции 0001–0011: какие таблицы создают, какие ALTER TABLE выполняют
  - [x] Составить список таблиц, отсутствующих в миграциях: `works`, `act_templates`, `messages`, `acts`, `attachments`, `act_template_selections`, `schedules`, `schedule_tasks`
  - [x] Определить безопасное подмножество колонок для 0000 (не включая те, что добавляются ALTER TABLE в последующих миграциях без `IF NOT EXISTS`)
  - [x] Создать `migrations/0000_initial_schema.sql` с базовой схемой
  - [x] Обновить changelog и tasktracker
- **Зависимости**: нет

---

## Задача: Bootstrap-миграция для пустой БД
- **Статус**: Завершена
- **Описание**: `npm run db:migrate` должен полностью поднимать схему на чистой БД без ошибок. Проблема: таблицы `works`, `acts` и другие создавались через `drizzle-kit push`, но ни в одной миграции не были созданы — последующие миграции ссылались на них через FK.
- **Шаги выполнения**:
  - [x] Проанализировать все миграции 0001–0011: какие таблицы создают, какие ALTER TABLE выполняют
  - [x] Составить список таблиц, отсутствующих в миграциях: `works`, `act_templates`, `messages`, `acts`, `attachments`, `act_template_selections`, `schedules`, `schedule_tasks`
  - [x] Определить безопасное подмножество колонок для 0000 (не включая те, что добавляются ALTER TABLE в последующих миграциях без `IF NOT EXISTS`)
  - [x] Создать `migrations/0000_initial_schema.sql` с базовой схемой
  - [x] Обновить changelog и tasktracker
- **Зависимости**: нет

---

## Задача: Раздел 3 журнала работ — два источника данных (messages + acts)
- **Статус**: Завершена
- **Описание**: Раздел 3 Общего журнала работ теперь отображает данные из двух источников: сообщения пользователя (messages) и акты (acts/АОСР). Акты разворачиваются в строки: **одна строка на дату**, все работы акта за эту дату объединяются в одно описание через точку с запятой. Строки из messages визуально светлее и редактируемые, строки из актов — стандартный фон, readonly (редактируются через график).
- **Шаги выполнения**:
  - [x] `shared/routes.ts`: добавить схему `section3RowSchema` и тип `Section3Row`, маршрут `GET /api/worklog/section3`
  - [x] `server/routes.ts`: реализовать эндпоинт `/api/worklog/section3` (загрузка messages+acts, разворот актов по дням, мерж, сортировка)
  - [x] `server/routes.ts`: добавить утилиту `eachDayInRange(start, end)` для генерации массива дат
  - [x] `client/src/hooks/use-section3.ts`: создать хук для загрузки данных раздела 3
  - [x] `client/src/pages/WorkLog.tsx`: переключить с `useMessages()` на `useSection3()`, обновить стилизацию строк (messages светлее: `bg-blue-50/20`, acts стандартный фон)
  - [x] `docs/changelog.md`: добавить запись об изменениях
  - [x] `docs/tasktracker.md`: обновить статус задачи
- **Зависимости**: нет

---

## Задача: График работ — независимые объёмы работ в задачах
- **Статус**: Завершена
- **Описание**: Объёмы работ отвязаны от справочника ВОР/Смета. После bootstrap задачи хранят собственные `quantity`/`unit`, редактируемые независимо. Генерация актов суммирует объёмы из задач. Подготовлена база для разбиения на захватки.
- **Шаги выполнения**:
  - [x] SQL-миграция 0011: добавить `quantity`, `unit` в `schedule_tasks`, заполнить из источника
  - [x] `shared/schema.ts`: добавить поля в Drizzle-схему
  - [x] `shared/routes.ts`: расширить контракт PATCH
  - [x] `server/storage.ts`: bootstrap копирует quantity/unit; patch обрабатывает их
  - [x] `server/routes.ts`: generate-acts суммирует quantity из задач
  - [x] `client/src/pages/Schedule.tsx`: колонка «Объём» из task.quantity; диалог с полями «Объём»/«Ед. изм.» и предупреждением о превышении
  - [x] `client/src/hooks/use-schedules.ts`: тип патча расширен
- **Зависимости**: следующий шаг — разбиение задачи на захватки (снять идемпотентность по workId)

---

## Задача: График работ — захватки (разбиение вида работ на части)
- **Статус**: Не начата
- **Описание**: Возможность разбить один вид работ (ВОР/позиция сметы) на несколько задач-захваток в графике — каждая с собственным объёмом, датами и привязкой к акту. Захватки отображаются параллельно или последовательно. Акты составляются по захваткам (суммирование объёмов уже реализовано в generate-acts).
- **Шаги выполнения**:
  - [ ] **DB**: снять ограничение идемпотентности по `workId`/`estimatePositionId` в bootstrap (убрать проверку `existingWorkIds`/`existingPositionIds` — или сделать её опциональной через параметр)
  - [ ] **Backend** (`server/storage.ts`): добавить метод `splitScheduleTask(taskId)` — создаёт новую задачу с тем же `workId`/`estimatePositionId`, нулевым (или остаточным) объёмом и следующим `orderIndex`
  - [ ] **API** (`server/routes.ts`, `shared/routes.ts`): эндпоинт `POST /api/schedule-tasks/:id/split` → возвращает новую задачу
  - [ ] **Валидация**: при split предупреждать, если сумма объёмов захваток уже == 0 у исходной задачи (нечего разбивать)
  - [ ] **UI** (`Schedule.tsx`): кнопка «Разбить на захватку» в строке задачи (или в диалоге редактирования); новая задача появляется под исходной
  - [ ] **UI**: визуальное группирование захваток одного вида работ (отступ, метка «захватка 1/2» и т.д.)
  - [ ] **UI**: диалог: поле «Название захватки» (`titleOverride`) по умолчанию «[Наименование] — захватка N»
  - [ ] **Акты**: убедиться, что generate-acts корректно суммирует объёмы захваток, входящих в один акт (уже реализовано); проверить сценарий «захватки в разных актах»
- **Зависимости**: «График работ — независимые объёмы работ в задачах» (завершена)

---

## Задача: Смета — диагностика ошибки "Failed to fetch" при импорте
- **Статус**: Завершена
- **Описание**: При импорте Excel-сметы (ЛСР) на вкладке «Смета» появляется ошибка `Failed to fetch`. Нужно с runtime‑доказательствами определить причину (URL/доступность сервера/CORS/mixed content/лимит body) и исправить без регрессий.
- **Шаги выполнения**:
  - [x] Найти полный флоу: выбор файла → парсер → `useImportEstimate()` → `POST /api/estimates/import`
  - [x] Добавить точечные debug-логи (клиент: до/после fetch + catch; сервер: вход в роут + успех/ошибка)
  - [x] Воспроизвести импорт и собрать логи (один прогон, чистый `debug.log`)
  - [x] Подтвердить root-cause по логам: сервер падает из-за несовпадения схемы БД (`act_template_id` отсутствует), поэтому `fetch` даёт `Failed to fetch`
  - [x] Исправить миграцию `0010_act_from_schedule_task_data.sql` (очистка `act_template_selections` перед удалением legacy-актов), чтобы миграция применялась без FK-ошибок
  - [x] Внести исправление (минимальное), не удаляя instrumentation
  - [x] Повторно воспроизвести и подтвердить исправление по логам (клиент+сервер: `POST /api/estimates/import` возвращает `200`, список смет обновляется)
  - [x] Удалить debug-инструментализацию после подтверждения
- **Зависимости**: `client/src/pages/Works.tsx`, `client/src/hooks/use-estimates.ts`, `server/routes.ts`

---

## Задача: АОСР — акты только из графика (тип акта, материалы/схемы/документация на задаче)
- **Статус**: Завершена
- **Описание**: Перевести создание актов АОСР на единственный источник — график работ. Тип акта выбирается на задаче графика, материалы и документы качества привязываются к задаче. При генерации актов всё агрегируется автоматически, акты без задач удаляются, экспорт PDF использует тип акта и агрегированные данные.
- **Шаги выполнения**:
  - [x] БД: добавить поля `schedule_tasks` и `acts`, создать таблицу `task_materials`, удалить legacy-акты (SQL-миграция)
  - [x] Shared: обновить `shared/schema.ts` (новые поля + `task_materials`)
  - [x] Shared: обновить `shared/routes.ts` (PATCH schedule task, task materials API, расширить generate-acts)
  - [x] Backend: реализовать CRUD `task_materials`, синхронизацию типа акта, агрегацию в `generate-acts`, удаление пустых актов, warnings
  - [x] Backend: экспорт PDF — использовать `acts.act_template_id`, агрегированные чертежи/нормативы и схемы
  - [x] UI `/schedule`: расширить диалог задачи (тип акта, материалы, схемы, документация)
  - [x] UI `/acts`: экспорт через диалог, отображение типа, генерация из графика
  - [x] Smoke-check: TypeScript/линтер без ошибок
  - [x] Документация: обновить `docs/changelog.md`, `docs/tasktracker.md`, `docs/project.md`
- **Зависимости**: `migrations/0010_*`, `shared/schema.ts`, `shared/routes.ts`, `server/routes.ts`, `server/storage.ts`, `client/src/pages/Schedule.tsx`, `client/src/pages/Acts.tsx`

---

## Задача: График работ — объём и трудозатраты в отдельных колонках
- **Статус**: Завершена
- **Описание**: На экране `/schedule` привести левую часть графика к табличному виду с двумя строками на задачу: в первой строке показывать метаданные (№ позиции, акт, ед. изм.) и отдельные колонки «Объём» и «ТЗ», во второй строке — наименование работ на всю ширину (в том числе под «Объём/ТЗ») с переносом.
- **Шаги выполнения**:
  - [x] Изменить заголовок левой части: добавить колонки «Объём» и «ТЗ»
  - [x] Перестроить строку задачи в 2 строки:
    - [x] Строка 1: № позиции | Акт № | ед. изм. (без «Ед.:») + отдельные колонки «Объём» и «ТЗ»
    - [x] Строка 2: наименование работ на всю ширину левого блока (в т.ч. под «Объём/ТЗ») с переносом
  - [x] Увеличить ширину левой части до `w-[420px]` (header+body)
  - [x] Увеличить высоту строки (`rowHeight: 72`) и выровнять полосы Ганта по центру строки
  - [x] Smoke-check: TypeScript/линтер без ошибок
  - [x] Документация: обновить `docs/changelog.md`, `docs/tasktracker.md`
- **Зависимости**: `client/src/pages/Schedule.tsx`

---

## Задача: График работ — вывод данных позиции сметы (ед. изм., объём, трудозатраты)
- **Статус**: Завершена
- **Описание**: На экране `/schedule` при источнике «Смета» показывать в строке задачи данные из позиции сметы: ед. изм., объём и трудозатраты (чел.-ч) при наличии. Трудозатраты считаются по ресурсам позиции (ОТ+ОТМ) по `quantityTotal` с фолбэком на `quantity`.
- **Шаги выполнения**:
  - [x] Добавить расчёт трудозатрат (ОТ+ОТМ) по `position.resources`
  - [x] Отобразить **ед. изм.** рядом с «Акт №» (в одной строке)
  - [x] Отобразить **объём** справа от наименования работ (в той же строке)
  - [x] Отобразить трудозатраты (чел.-ч) по ресурсам (ОТ+ОТМ), если есть
  - [x] Smoke-check: TypeScript/линтер без ошибок
  - [x] Документация: обновить `docs/changelog.md`, `docs/tasktracker.md`
- **Зависимости**: `client/src/pages/Schedule.tsx`, `estimates.get` (позиции с resources)

---

## Задача: Партии материалов — удалить поле «Производитель» (manufacturer)
- **Статус**: Завершена
- **Описание**: Поле «Производитель» в окне «Добавить партию» не использовалось в бизнес-логике и экспорте. Удалить из БД, API, storage и UI.
- **Шаги выполнения**:
  - [x] БД: миграция `0009_drop_material_batches_manufacturer.sql` — идемпотентное удаление колонки `manufacturer` из `material_batches`
  - [x] Shared: удалить поле из схемы `material_batches` и из контракта API (create/patch партии)
  - [x] Backend: убрать `manufacturer` из типов и патча в `server/storage.ts`
  - [x] UI: удалить поле из `BatchForm.tsx`, `MaterialWizard.tsx`, `SourceMaterialDetail.tsx`, тип в `MaterialDetailView.tsx`
  - [x] Документация: обновить `docs/changelog.md`, `docs/tasktracker.md`
- **Зависимости**: миграции, shared/schema.ts, shared/routes.ts, server/storage.ts, клиентские компоненты партий

---

## Задача: Документы — удалить поле «Кем выдан» (issuer)
- **Статус**: Завершена
- **Описание**: Поле «Кем выдан» не нужно в проекте. Необходимо удалить его из БД, API, поиска документов и всех форм/экранов (включая окно «привязать документ», мастер добавления материала, реестр документов, страница «Исходные данные»).
- **Шаги выполнения**:
  - [x] БД: создать миграцию `0008_drop_documents_issuer.sql` — `ALTER TABLE documents DROP COLUMN IF EXISTS issuer`
  - [x] Shared: удалить поле `issuer` из схемы таблицы `documents` (`shared/schema.ts`)
  - [x] API: удалить поле `issuer` из API-контракта создания документа (`shared/routes.ts`)
  - [x] Backend: удалить `ilike(documents.issuer, ...)` из поиска документов (`server/storage.ts`)
  - [x] UI: удалить тип и отображение `issuer` из `DocumentCard.tsx`
  - [x] UI: удалить поле «Кем выдан» из формы «Привязать документ» (`SourceMaterialDetail.tsx`)
  - [x] UI: удалить поле «Кем выдан» из мастера добавления материала (`MaterialWizard.tsx`)
  - [x] UI: удалить поле «Кем выдан» из страницы «Исходные данные» (`SourceData.tsx`)
  - [x] UI: удалить поле «Кем выдан» из реестра документов (`SourceDocuments.tsx`)
  - [x] Smoke-test: `npm run check`
  - [x] Документация: обновить `docs/changelog.md`, `docs/tasktracker.md`
- **Зависимости**: `migrations/0008_drop_documents_issuer.sql`, `shared/schema.ts`, `shared/routes.ts`, `server/storage.ts`, `client/src/components/documents/DocumentCard.tsx`, `client/src/pages/SourceMaterialDetail.tsx`, `client/src/components/materials/MaterialWizard.tsx`, `client/src/pages/SourceData.tsx`, `client/src/pages/SourceDocuments.tsx`

---

## Задача: График работ — статусы документов качества по подстрокам сметы (MVP)
- **Статус**: Завершена
- **Описание**: На экране `/schedule` для подстрок сметы (`estimate_positions`, вспомогательные позиции) показывать вычисляемый статус документов качества (`none|partial|ok`). Привязка подстроки к материалу должна быть детерминированной (ручной выбор `project_materials`), статус вычисляется по `document_bindings` + `documents`.
- **Шаги выполнения**:
  - [x] DB: добавить таблицу `estimate_position_material_links` (связь подстрока → material) и индексы
  - [x] Shared: добавить Drizzle-схему/типы для `estimate_position_material_links`
  - [x] Backend: storage-методы (list/upsert/delete) и батч-расчёт статусов
  - [x] API: эндпоинты статусов подстрок и CRUD привязок (контракт + реализация)
  - [x] Frontend: react-query хуки для статусов/привязок
  - [x] UI `/schedule`: Badge статуса на подстроках + диалог привязки материала
  - [x] Smoke-test: привязка подстроки → статус меняется при refetch и при изменении документа
- **Зависимости**: `shared/schema.ts`, `shared/routes.ts`, `server/storage.ts`, `server/routes.ts`, `client/src/pages/Schedule.tsx`

---

## Задача: ВОР — удаление сметы не должно падать с 500 (если смета используется графиком)
- **Статус**: Завершена
- **Описание**: При попытке удалить смету на вкладке ВОР сервер возвращал `500 Internal Server Error`, если эта смета была выбрана источником графика работ (`schedules.sourceType='estimate'`). Нужно заменить падение на контролируемую ошибку и подсказку пользователю.
- **Шаги выполнения**:
  - [x] Найти причину: конфликт `ON DELETE SET NULL` с CHECK-constraint `schedules_estimate_id_required`
  - [x] Backend: добавить проверку “смета используется графиком” перед удалением (storage.deleteEstimate)
  - [x] Backend: вернуть `409` и понятное сообщение в `DELETE /api/estimates/:id`
  - [x] Shared: расширить контракт `api.estimates.delete` (добавить ответ `409`)
  - [x] Документация: обновить `docs/changelog.md`, `docs/tasktracker.md`
- **Зависимости**: `server/storage.ts`, `server/routes.ts`, `shared/routes.ts`, миграция `0006_schedule_estimate_source.sql`

---

## Задача: ВОР — удаление сметы-источника с предупреждением и сбросом графика/актов
- **Статус**: Завершена
- **Описание**: Если смета выбрана источником графика работ, пользователю нужно дать возможность удалить смету без ручной смены источника. При подтверждении удаления должны быть сброшены задачи графика и очищены списки работ в затронутых актах, затем смета удаляется. После этого пользователь может выбрать новый источник на экране `/schedule`.
- **Шаги выполнения**:
  - [x] Backend: расширить `storage.deleteEstimate` — опция `resetScheduleIfInUse` (сброс schedule_tasks + очистка worksData + перевод источника на ВОР)
  - [x] Backend: `DELETE /api/estimates/:id` — поддержка query `resetSchedule=1`
  - [x] Frontend: `useDeleteEstimate` — флаг `resetSchedule` + проброс `status` ошибки (для 409)
  - [x] UI `/works`: диалог предупреждения при 409 и повторный delete с `resetSchedule=1`
  - [x] Документация: `docs/changelog.md`, `docs/project.md`, `docs/tasktracker.md`
- **Зависимости**: `server/storage.ts`, `server/routes.ts`, `client/src/hooks/use-estimates.ts`, `client/src/pages/Works.tsx`, `shared/routes.ts`

---

## Задача: График работ — таймлайн должен смещаться вместе с раскрытыми подстроками
- **Статус**: Завершена
- **Описание**: На экране `/schedule` при раскрытии вспомогательных подстрок (позиции/материалы) левый список увеличивался, а полосы таймлайна оставались на прежних `y`-координатах. Нужно синхронизировать вертикальную разметку: высоту таймлайна и позицию каждой полосы.
- **Шаги выполнения**:
  - [x] Выявить причину: таймлайн рассчитывал высоту/`top` только по `tasks.length`, игнорируя раскрытые подстроки
  - [x] Добавить расчёт “виртуальных строк” (main + expanded auxiliaries) и использовать его для `height` и `top`
  - [x] Зафиксировать высоту строки для подстрок, чтобы выравнивание было стабильным
  - [x] Подготовить место в UI под будущие статусы документов качества для вспомогательных строк
  - [x] Smoke-check TypeScript: `npm run check`
- **Зависимости**: `client/src/pages/Schedule.tsx`

---

## Задача: График работ — статусы документов качества по подстрокам сметы (спецификация + план)
- **Статус**: Завершена
- **Описание**: Зафиксировать, как внедряем статусы документов качества на экране `/schedule` для подстрок‑позиций сметы (`estimate_positions`): MVP (привязка подстроки к `project_material`) и план PRO (требования к типам документов, партии, автосопоставление, агрегаты).
- **Шаги выполнения**:
  - [x] Уточнить текущую модель: подстроки в графике = вспомогательные `estimate_positions`
  - [x] Выбрать концепцию: детерминированная привязка подстроки сметы к материалу проекта и вычисляемый статус
  - [x] Описать MVP: схема БД, API, расчёт статусов, UI в `/schedule`, критерии готовности
  - [x] Описать PRO: требования к документам, партии, автосопоставление, агрегаты и производительность
  - [x] Оформить отдельным документом `docs/techspec_quality_statuses_schedule.md`
- **Зависимости**: `documents`, `document_bindings`, `project_materials`, `material_batches`, модуль `/schedule`

---

## Задача: График работ из Сметы (Вариант 1 — "Правильная модель")
- **Статус**: Завершена
- **Описание**: Добавить возможность строить график работ из позиций сметы (estimate_positions) вместо ВОР. График имеет единственный источник (ВОР или Смета), смена источника требует подтверждения и удаляет все задачи. Акты хранят явный `sourceType` + `sourceId` для каждой строки работ. Основные задачи графика создаются только для позиций ГЭСН/ФЕР/ТЕР, вспомогательные позиции (ФСБЦ, прайс) отображаются как подстроки (по умолчанию свёрнуты).
- **Шаги выполнения**:
  - [x] DB: миграция `0006_schedule_estimate_source.sql` (schedules.sourceType, schedules.estimateId, schedule_tasks.estimatePositionId)
  - [x] Shared: обновить типы `Schedule`, `ScheduleTask`, `ActWorkItem`, API-контракты в `shared/routes.ts`
  - [x] Shared: добавить Zod-схему `actWorkItemSchema`
  - [x] Backend: реализовать `storage.changeScheduleSource()`, `storage.bootstrapScheduleFromEstimate()`, `storage.getEstimatePositionsByIds()`
  - [x] Backend: хелпер `isMainEstimatePosition()` для фильтра основных позиций (ГЭСН/ФЕР/ТЕР)
  - [x] Backend: обновить генерацию актов (ветвление по `schedule.sourceType`)
  - [x] Backend: новые эндпоинты `source-info`, `change-source`, `bootstrap-from-estimate` в `server/routes.ts`
  - [x] Frontend: хуки `useScheduleSourceInfo()`, `useChangeScheduleSource()`, `useBootstrapScheduleFromEstimate()`, `useGenerateActsFromSchedule()`
  - [x] Frontend: UI на `/schedule` — селектор источника (ВОР/Смета), кнопка генерации актов, диалог подтверждения смены (регистронезависимая проверка)
  - [x] Frontend: группировка вспомогательных позиций под основными на клиенте
  - [x] UI: кнопка expand/collapse для вспомогательных подстрок (только в левой колонке, не влияют на таймлайн)
  - [x] Документация: обновить `project.md`, `tasktracker.md`, `changelog.md`
- **Зависимости**: Модуль "Смета/ЛСР", Модуль "График работ"

---

## Задача: UI — «Материалы»: вертикальный скролл и кнопка «Назад к материалам»
- **Статус**: Завершена
- **Описание**: На странице `/source/materials` обеспечить корректную вертикальную прокрутку списка/контента на мобильных. На странице `/source/materials/:id` добавить кнопку возврата на список материалов.
- **Шаги выполнения**:
  - [x] Зафиксировать задачу в документации (tasktracker/changelog)
  - [x] UI: исправить layout/ScrollArea на `/source/materials` для корректного scroll
  - [x] UI: добавить кнопку «Назад к материалам» на `/source/materials/:id`
  - [x] Smoke-test: `npm run check` + проверка скролла/навигации на мобильном размере
- **Зависимости**: `client/src/pages/SourceMaterials.tsx`, `client/src/pages/SourceMaterialDetail.tsx`

---

## Задача: UI — «Материалы»: дата поставки — ввод `дд/мм/гггг` + календарь
- **Статус**: Завершена
- **Описание**: Поле «Дата поставки» в форме партии/поставки должно поддерживать ручной ввод в формате `дд/мм/гггг` и выбор даты кликом через выпадающий календарь (Popover/Calendar). В БД/запросах сохраняется ISO `YYYY-MM-DD`.
- **Шаги выполнения**:
  - [x] Зафиксировать задачу в документации (tasktracker/changelog)
  - [x] UI: заменить `type="date"` на контролируемое поле с отображением `dd/mm/yyyy`
  - [x] UI: добавить выпадающий календарь (Popover/Calendar) для выбора даты кликом
  - [x] UI: конвертация ввода `dd/mm/yyyy` → ISO `YYYY-MM-DD` для отправки на сервер
  - [x] UI: отображение даты поставки привести к `dd/mm/yyyy` в деталке материала
  - [x] Smoke-test: `npm run check`
- **Зависимости**: `client/src/components/materials/BatchForm.tsx`, `client/src/components/materials/MaterialDetailView.tsx`

---

## Задача: UI — исправить “прозрачные” выпадающие списки и календари (Select/Popover)
- **Статус**: Завершена
- **Описание**: В выпадающих списках (Radix Select) и календарях (Popover/Calendar) фон контента должен быть непрозрачным. Сейчас оверлеи выглядят прозрачными из-за отсутствующих CSS-переменных темы `--popover*`/`--card*` (Tailwind цвета `bg-popover`, `bg-card`).
- **Шаги выполнения**:
  - [x] Зафиксировать задачу в документации (tasktracker/changelog)
  - [x] UI: добавить недостающие переменные `--popover*` и `--card*` в `client/src/index.css` для светлой/тёмной темы
  - [x] Smoke-test: проверить Select (тип документа в мастере материала) и календари в актах/поставке
- **Зависимости**: `client/src/index.css`, `client/src/components/ui/select.tsx`, `client/src/components/ui/popover.tsx`

---

## Задача: UI — материалы: добавить партию и привязать документ к существующему материалу (Roadmap)
- **Статус**: Завершена
- **Описание**: На странице материала `/source/materials/:id` реализовать действия из `docs/RoadmapIsodnieDannie.md`: добавить новую партию/поставку (создание `material_batches`) и привязать документ качества к материалу (создание `document_bindings`, выбор из реестра или создание нового).
- **Шаги выполнения**:
  - [x] Зафиксировать задачу в документации (tasktracker/changelog)
  - [x] UI: CTA «Добавить партию» в блоке партий → bottom sheet (Drawer) с `BatchForm` → `POST /api/project-materials/:id/batches`
  - [x] UI: CTA «Привязать документ» в блоке документов → bottom sheet (Drawer): выбор из реестра / создать новый → `POST /api/document-bindings`
  - [x] UX: если “Нет документа качества для актов” — показать кнопку “Добавить” (открывает привязку документа)
  - [x] Smoke-test: `npm run check`, ручная проверка на мобильном размере
- **Зависимости**: `client/src/pages/SourceMaterialDetail.tsx`, `client/src/components/materials/MaterialDetailView.tsx`, `client/src/hooks/use-materials.ts`, `client/src/hooks/use-documents.ts`

---

## Задача: UI — материалы: привязка документа к конкретной партии (вариант 3B)
- **Статус**: Завершена
- **Описание**: В деталке материала `/source/materials/:id` добавить возможность привязать документ не только к материалу (всем партиям), но и к конкретной партии поставки (`material_batches`). В блоке «Документы» показывать карточки по привязкам с подписью области привязки. В мастере добавления материала — опция привязать документ к добавленной партии.
- **Шаги выполнения**:
  - [x] UI: `MaterialDetailView` — отображение документов по привязкам (вариант B), подпись «На все партии/Партия …», кнопка «Привязать документ» на карточке партии
  - [x] UI: `SourceMaterialDetail` — выбор цели привязки (материал/партия) в drawer «Привязать документ», поддержка открытия drawer’а из партии с предвыбранной партией, передача `batchId` в `POST /api/document-bindings`
  - [x] UI: `MaterialWizard` — выбор «к материалу / к добавленной партии», передача `batchId` созданной партии при создании привязки
  - [x] Smoke-test: `npm run check`
- **Зависимости**: `client/src/components/materials/MaterialDetailView.tsx`, `client/src/pages/SourceMaterialDetail.tsx`, `client/src/components/materials/MaterialWizard.tsx`, `shared/routes.ts`

---

## Задача: UI — экран «Исходные»: сценарии и карточки-разделы (Roadmap 52–114)
- **Статус**: Завершена
- **Описание**: Привести страницу `/source-data` в соответствие с UX из `docs/RoadmapIsodnieDannie.md` (52–114): sticky-выбор объекта, строка адреса, горизонтальный скролл сторон/участников и карточки-разделы (не табы) со счётчиками и CTA «Добавить».
- **Шаги выполнения**:
  - [x] Зафиксировать задачу в документации (tasktracker/changelog)
  - [x] UI: sticky-блок «Объект: … ▾» + адрес (1 строка) + индикатор сохранения
  - [x] UI: блок «Стороны/участники» с горизонтальным скроллом карточек (заказчик/подрядчик/проектировщик)
  - [x] UI: блок «Разделы» с 4 карточками, счётчиками и CTA «Добавить»
  - [x] Smoke-test: `npm run check`; переходы в `/source/materials` и `/source/documents`, кнопки «Добавить» открывают мастер/диалог
- **Зависимости**: `client/src/pages/SourceData.tsx`, `docs/RoadmapIsodnieDannie.md`

---

## Задача: UI — «Исходные»: баннер «Ответственные лица» в карусели + модальное редактирование
- **Статус**: Завершена
- **Описание**: Добавить в горизонтальную карусель на `/source-data` баннер «Ответственные лица». По клику открывать окно редактирования ответственных лиц. Нижний список/формы ответственных удалить (без дублирования на экране).
- **Шаги выполнения**:
  - [x] Зафиксировать изменение в документации (tasktracker/changelog)
  - [x] UI: добавить карточку «Ответственные лица» в карусель
  - [x] UI: перенести форму ответственных лиц в `Dialog` (модальное окно)
  - [x] UI: удалить нижний список/формы (Accordion) со страницы
  - [x] Smoke-test: `npm run check`
- **Зависимости**: `client/src/pages/SourceData.tsx`

---

## Задача: UI — мастер добавления материала: синхронизация единиц измерения (материал → партия)
- **Статус**: Завершена
- **Описание**: В мастере добавления материала при вводе “Ед. измерения” (шаг 2, “Создать новый”) автоматически подставлять это значение в “Ед.” партии (шаг 3), **если поле партии ещё пустое** (не перетирать ручной ввод).
- **Шаги выполнения**:
  - [x] Зафиксировать изменение в документации (tasktracker/changelog)
  - [x] UI: синхронизировать `baseUnitOverride` → `batch.unit` при вводе, если `batch.unit` пустой
  - [x] UI: при включении “Добавить партию/поставку” подставлять единицу из `baseUnitOverride`, если `batch.unit` пустой
  - [x] Smoke-test: `npm run check`
- **Зависимости**: `client/src/components/materials/MaterialWizard.tsx`, `client/src/components/materials/BatchForm.tsx`

---

## Задача: Roadmap "Исходные данные" — исправление схемы БД и приведение к стандартам rulesdb.mdc
- **Статус**: Завершена
- **Описание**: Проверить соответствие roadmap'а `docs/RoadmapIsodnieDannie.md` правилам проектирования БД из `rulesdb.mdc` и архитектуре проекта. Внести исправления: унифицировать именование (`objectId` вместо `projectId`), добавить типы данных, CHECK constraints, индексы, триггеры, разрешить коллизию `attachments` vs `act_document_attachments`, добавить связь материал ↔ работа.
- **Шаги выполнения**:
  - [x] Проанализировать roadmap на соответствие `project.md` и `rulesdb.mdc`
  - [x] Унифицировать именование: `objectId` вместо `projectId` во всех таблицах и API
  - [x] Доработать схему таблиц: добавить типы `bigint GENERATED ALWAYS AS IDENTITY`, `created_at`/`updated_at` (timestamptz)
  - [x] Добавить CHECK constraints для всех статусов/типов (`doc_type`, `scope`, `category`, `binding_role`)
  - [x] Добавить явные политики `ON DELETE` для всех FK (cascade/restrict/setNull)
  - [x] Указать доменный масштаб для `material_batches.quantity`: `numeric(14,3)`
  - [x] Добавить описание триггеров `set_updated_at()` для всех таблиц
  - [x] Создать сводную таблицу индексов (раздел 2.9)
  - [x] Добавить поле `workId` в `act_material_usages` для связи материал ↔ работа
  - [x] Разрешить коллизию `attachments` vs `act_document_attachments`: выбран вариант "две таблицы" (раздел 8)
  - [x] Обновить API endpoints: `/api/objects/:objectId/materials` вместо `/api/projects/:projectId/materials`
  - [x] Обновить документацию (changelog, tasktracker)
- **Зависимости**: `docs/RoadmapIsodnieDannie.md`, `docs/project.md`, `.cursor/rules/rulesdb.mdc`

---

## Задача: Исходные данные — материалы/документы качества + интеграция с АОСР (MVP)
- **Статус**: Завершена
- **Описание**: Реализовать модуль материалов (справочник + материалы объекта), партии/поставки, реестр документов качества и привязки к материалам/партиям, а также подготовить интеграцию с АОСР (п.3 “применены материалы” и “приложения”).
- **Шаги выполнения**:
  - [x] DB: добавить SQL-миграцию `migrations/0005_materials_documents.sql` (7 таблиц + индексы + CHECK + updated_at triggers)
  - [x] Shared: добавить Drizzle-таблицы/типы в `shared/schema.ts`
  - [x] Shared: добавить API-контракты в `shared/routes.ts` (materialsCatalog/projectMaterials/batches/documents/bindings/actUsages/actDocAttachments)
  - [x] Backend: реализовать методы storage в `server/storage.ts`
  - [x] Backend: добавить маршруты в `server/routes.ts`
  - [x] Frontend: хуки React Query для материалов/документов/актов
  - [x] Frontend: страницы `/source/materials`, `/source/materials/:id`, `/source/documents` и быстрые переходы с `/source-data`
  - [x] PDF: сборка `p3MaterialsText` и `attachmentsText` из БД при экспорте акта (если не переопределено `formData`)
  - [x] UI актов: выбор материалов для п.3 и управление приложениями (dedupe по документам)
  - [x] Smoke-test: `npm run check`, `npm run build`
- **Зависимости**: `shared/schema.ts`, `shared/routes.ts`, `server/storage.ts`, `server/routes.ts`, `server/pdfGenerator.ts`, `client/src/pages/*`

---

## Задача: АОСР — ультратонкие линии подчёркивания 0.1pt и выравнивание подсказок по центру
- **Статус**: Завершена
- **Описание**: Сделать линии подчёркивания в бланковых полях ультратонкими (0.1pt) и выровнять все hint-подсказки по центру для улучшения визуального оформления документа.
- **Шаги выполнения**:
  - [x] Создать кастомный layout "thinUnderline" в `pdfGenerator.ts` с толщиной линии 0.1pt
  - [x] Заменить все `layout: { "defaultBorder": false }` на `layout: "thinUnderline"` в шаблоне
  - [x] Добавить `alignment: "center"` в стиль `hint`
  - [x] Уточнить толщину линии: сначала 0.5pt, затем уменьшить до 0.1pt по запросу пользователя
  - [x] **FIX**: Удалить все явные `border` и `borderColor` из ячеек таблиц (они переопределяли кастомный layout)
  - [x] **FIX**: Передавать `tableLayouts` через `createPdfKitDocument(..., { tableLayouts })` (иначе pdfmake применял дефолтную сетку)
  - [x] **FIX**: Таблицы подсказок под подписями перевести на `layout: "noBorders"` (там не должно быть подчёркиваний)
  - [x] Вернуть толщину линии `thinUnderline` на 0.5pt (0.1pt визуально почти не заметен)
  - [x] Добавить layout `rowUnderline` для подчёркивания каждой строки таблицы
  - [x] Включить `rowUnderline` для таблицы “5. Даты”
  - [x] Перегенерировать тестовые PDF и проверить результат
  - [x] Обновить документацию (changelog, tasktracker)
- **Зависимости**: `server/pdfGenerator.ts`, `server/templates/aosr/aosr-template.json`

---

## Задача: АОСР — минимизация межстрочных интервалов
- **Статус**: Завершена
- **Описание**: Уменьшить избыточные вертикальные отступы между hint-подсказками и последующими заголовками разделов. Убрать ошибочный перенос строки в заголовке "Застройщик... региональный оператор:".
- **Шаги выполнения**:
  - [x] Уменьшить нижний отступ стиля `hint` с 4 до 1 пункта
  - [x] Уменьшить верхний отступ стиля `sectionLabel` с 6 до 3 пунктов
  - [x] Убрать `\n` между "региональный" и "оператор:" в заголовке Застройщика
  - [x] Перегенерировать тестовые PDF
  - [x] Обновить документацию (changelog, tasktracker)
- **Зависимости**: `server/templates/aosr/aosr-template.json`

---

## Задача: АОСР — финальная доработка верстки шаблона (отступы, линии, таблицы)
- **Статус**: Завершена
- **Описание**: Довести визуальное оформление шаблона АОСР до максимального соответствия эталону `005_АОСР 4.pdf`: скорректировать отступы заголовков, толщину и цвет линий подчёркивания, унифицировать layout всех таблиц. Формат дат остаётся без изменений (частичное соответствие).
- **Шаги выполнения**:
  - [x] Скорректировать отступы вокруг заголовков "АКТ" и "освидетельствования скрытых работ"
  - [x] Увеличить lineHeight с 1.05 до 1.1 для лучшей читаемости
  - [x] Привести все таблицы с подчёркиваниями к единому layout: { "defaultBorder": false }
  - [x] Изменить цвет линий подчёркивания с #666666 на #000000 (чёрный) для всех бланковых полей
  - [x] Добавить borderColor: "#000000" к ячейкам в таблицах № акта и количества экземпляров
  - [x] Перегенерировать тестовые PDF и провести визуальное сравнение с эталоном
  - [x] Обновить документацию (changelog, tasktracker)
- **Зависимости**: `server/templates/aosr/aosr-template.json`

---

## Задача: Экспорт АОСР — реквизиты Заказчика/Подрядчика в PDF (ИНН/ОГРН/юр.адрес/телефон)
- **Статус**: Завершена
- **Описание**: При экспорте акта в PDF поля организаций (Заказчик/Подрядчик/Проектировщик) должны формироваться не только из полного наименования, но и включать реквизиты: ИНН, ОГРН, юридический адрес и телефон/факс (если заполнены в “Исходных данных”).
- **Шаги выполнения**:
  - [x] Зафиксировать задачу в документации (tasktracker/changelog/project)
  - [x] Backend: расширить форматирование организаций в `server/pdfGenerator.ts` (buildOrg)
  - [x] Привести формат реквизитов к “бланковому” виду (переносы строк + явные лейблы)
  - [x] Smoke-test: `npm run check`; ручной сценарий: заполнить реквизиты на `/source-data` → экспорт PDF → в полях организаций присутствуют ИНН/ОГРН/адрес/телефон
  - [x] Обновить статус задачи в `tasktracker.md`
- **Зависимости**: `server/pdfGenerator.ts`, `shared/routes.ts` (PartyDto), `client/src/pages/SourceData.tsx`

---

## Задача: Исходные данные — реквизиты СРО для сторон (Заказчик/Подрядчик/Проектировщик)
- **Статус**: Завершена
- **Описание**: Расширить “стороны” в исходных данных (`object_parties`) реквизитами саморегулируемой организации (СРО): полное/сокращённое наименование СРО, ОГРН СРО, ИНН СРО. Данные должны сохраняться в БД и быть доступны для подстановки в акты/шаблоны.
- **Шаги выполнения**:
  - [x] Зафиксировать задачу в документации (tasktracker/changelog)
  - [x] Расширить тип `PartyDto` и API-контракт `sourceDataDtoSchema` (shared)
  - [x] DB: добавить поля в `object_parties` + миграция `migrations/0004_*`
  - [x] Backend: обновить `getObjectSourceData/saveObjectSourceData` под новые поля
  - [x] Frontend: добавить поля ввода на странице `/source-data` (в секции Заказчик/Подрядчик/Проектировщик)
  - [x] Обновить i18n (ru/en) для новых лейблов
  - [x] Smoke-test сохранения/чтения
  - [x] Обновить статус задачи в `tasktracker.md`
- **Зависимости**: `shared/routes.ts`, `shared/schema.ts`, `server/storage.ts`, `client/src/pages/SourceData.tsx`

---

## Задача: Акты — исходные данные объекта должны попадать в акт при создании/экспорте
- **Статус**: Завершена
- **Описание**: Исправить сценарий создания акта так, чтобы в созданном акте был корректный `objectId` (текущий объект), и при экспорте PDF данные из `/source-data` автоматически подставлялись в плейсхолдеры (если не переопределены formData).
- **Шаги выполнения**:
  - [x] Зафиксировать задачу в документации (tasktracker/changelog)
  - [x] Проверить создание актов (`/api/acts/create-with-templates`, генерация актов из графика) — где теряется `objectId`
  - [x] Починить: при создании акта ставить `objectId` текущего объекта по умолчанию
  - [x] Smoke-test: заполнить `/source-data` → создать акт → экспорт PDF содержит объект/стороны/ответственных
  - [x] Обновить статус задачи в `tasktracker.md`
- **Зависимости**: `server/routes.ts`, `server/storage.ts`, `server/pdfGenerator.ts`, `shared/schema.ts`

---

## Задача: UI — “Исходные данные”: заполнение тестовыми данными
- **Статус**: Завершена
- **Описание**: Добавить быстрый способ заполнить все поля анкеты `/source-data` тестовыми значениями (объект, стороны, ответственные лица) для демонстрации/проверки генерации плейсхолдеров.
- **Шаги выполнения**:
  - [x] Зафиксировать задачу в документации (tasktracker/changelog)
  - [x] Добавить кнопку “Заполнить тестовыми” рядом с “Сохранить”
  - [x] Реализовать генератор демо-данных и заполнение `draft`
  - [x] Smoke-test: все поля заполняются и после “Сохранить” данные уходят на сервер
  - [x] Обновить статус задачи в `tasktracker.md`
- **Зависимости**: `client/src/pages/SourceData.tsx`

---

## Задача: UI — “Исходные данные”: по умолчанию все секции свёрнуты
- **Статус**: Завершена
- **Описание**: На странице `/source-data` убрать автраскрытие секций (Accordion). После обновления страницы все вкладки должны быть свёрнуты, пользователь раскрывает нужные вручную.
- **Шаги выполнения**:
  - [x] Зафиксировать изменение в документации (tasktracker/changelog)
  - [x] Убрать `defaultValue` с предраскрытыми секциями, оставить состояние “всё закрыто” по умолчанию
  - [x] Smoke-test: после reload все секции закрыты
  - [x] Обновить статус задачи в `tasktracker.md`
- **Зависимости**: `client/src/pages/SourceData.tsx`

---

## Задача: UI — вкладка “Исходные данные”: корректная высота/скролл на мобильных
- **Статус**: Завершена
- **Описание**: Сделать так, чтобы на странице `/source-data` контент корректно помещался по вертикали на мобильных устройствах: высота экрана учитывала динамическую область браузера, а прокрутка выполнялась внутри контента между `Header` и `BottomNav` без перекрытий.
- **Шаги выполнения**:
  - [x] Зафиксировать проблему и план исправления в документации (tasktracker/changelog)
  - [x] Переработать layout страницы `/source-data`: `100dvh` + flex‑контейнеры + `ScrollArea` на `flex-1`
  - [x] Smoke-test на мобильном размере: контент не “уезжает” под `BottomNav`, прокрутка стабильна
  - [x] Обновить статус задачи в `tasktracker.md`
- **Зависимости**: `client/src/pages/SourceData.tsx`, `client/src/components/Header.tsx`, `client/src/components/BottomNav.tsx`

---

## Задача: ГЭСН — парсинг PDF в SQLite (улучшения)
- **Статус**: Завершена
- **Описание**: Улучшить утилиту `gesn_pdf_to_sqlite.py` для стабильного парсинга справочников ГЭСН: добавить индексы БД, статистику, обработку ошибок по страницам, расширить список единиц измерения, включить запись `gesn_work_step` и режим `--dry-run`, а также актуализировать документацию.
- **Шаги выполнения**:
  - [x] Добавить `requirements.txt` и базовый `README.md` для утилиты
  - [x] Обновить документацию (changelog/tasktracker/project)
  - [x] Добавить индексы БД и финальную статистику
  - [x] Добавить обработку ошибок на уровне страницы
  - [x] Расширить список единиц измерения
  - [x] Записать `gesn_work_step` в БД
  - [x] Добавить режим `--dry-run`
  - [x] Зафиксировать сохранение SQLite-файла в `attached_assets/GESN/` при относительном пути `--db`
  - [x] Обновить документацию после изменений
- **Зависимости**: Нет

---

## Задача: Парсинг суммы количества ресурсов с учётом коэффициентов
- **Статус**: Завершена
- **Описание**: Добавить в парсер сметы и БД поддержку колонки "всего с учётом коэффициентов" для ресурсов. Теперь для каждого ресурса сохраняются два значения: норматив на единицу (quantity) и сумма с учётом коэффициентов (quantityTotal).
- **Шаги выполнения**:
  - [x] Обновить типы и ColMap в estimateParser.ts (добавить quantityTotal)
  - [x] Обновить detectColumns() для поиска колонки "всего с учётом коэффициентов"
  - [x] Обновить парсинг ресурсов для чтения значения quantityTotal
  - [x] Добавить колонку quantity_total в таблицу position_resources (shared/schema.ts)
  - [x] Создать миграцию БД migrations/0003_add_quantity_total.sql
  - [x] Обновить валидацию в shared/routes.ts для поддержки нового поля
  - [x] Обновить документацию (changelog.md, tasktracker.md)
- **Зависимости**: Модуль "ВОР/Смета", парсер estimateParser.ts

---

## Задача: ВОР — вкладка «Смета» (ЛСР) с отдельной сущностью и импортом Excel (ГРАНД‑Смета)
- **Статус**: Завершена
- **Описание**: Добавить отдельную сущность «Смета/ЛСР» (нормализованные таблицы) и UI-переключатель на вкладке ВОР между “Работы” и “Смета”. Импорт сметы выполняется из Excel-выгрузки ГРАНД‑Сметы: поиск строки начала таблицы, разбор блоков позиции и строк ресурсов.
- **Шаги выполнения**:
  - [x] DB: добавить таблицы `estimates`, `estimate_sections`, `estimate_positions`, `position_resources`
  - [x] DB: добавить SQL-миграцию `migrations/0002_estimates.sql`
  - [x] Shared: расширить `shared/routes.ts` ресурсом `api.estimates`
  - [x] Backend: реализовать `GET /api/estimates`, `GET /api/estimates/:id`, `POST /api/estimates/import`, `DELETE /api/estimates/:id`
  - [x] Backend: реализовать транзакционный импорт и выдачу “смета → разделы → позиции → ресурсы” в `server/storage.ts`
  - [x] Frontend: добавить переключатель “Работы/Смета” и экран просмотра сметы на `/works`
  - [x] Frontend: добавить импорт сметы `.xlsx` и парсер `client/src/lib/estimateParser.ts`
  - [x] Проверки: `npm run check`, `npm run build`, smoke-test парсинга на эталонном файле ЛСР
- **Зависимости**: Модуль “ВОР” (`/works`), `xlsx`, Drizzle/PostgreSQL

---

## Задача: MVP — Объект строительства и “Исходные данные” для плейсхолдеров АОСР/ЖР
- **Статус**: Завершена
- **Описание**: Добавить сущность объекта строительства (MVP: один объект), справочник “исходных данных” (стороны + ответственные лица) и автоматическую подстановку этих данных в экспорт АОСР. На фронте — новая вкладка “Исходные”, “Главная” переносится в кнопку в правом верхнем углу, в бургер-меню отображается текущий объект.
- **Шаги выполнения**:
  - [x] DB: добавить таблицы `objects`, `object_parties`, `object_responsible_persons`; добавить `acts.object_id`
  - [x] Backend: расширить `server/storage.ts` (getOrCreateDefaultObject + get/save source-data)
  - [x] Backend: добавить API `GET/PATCH /api/object/current` и `GET/PUT /api/object/current/source-data`
  - [x] Backend: интегрировать source-data в `POST /api/acts/:id/export` (резолвер/мердж)
  - [x] Frontend: страница анкеты `/source-data` (Accordion + Save)
  - [x] Frontend: обновить `BottomNav`/`Header` (вкладка “Исходные”, кнопка “Главная”, текущий объект в меню)
- **Зависимости**: Модуль “Акты/Экспорт PDF” + текущая схема БД (Drizzle)

---

## Задача: UI — изменить порядок вкладок `BottomNav`
- **Статус**: Завершена
- **Описание**: Поменять порядок вкладок в нижней навигации слева направо на: **«ВОР» → «График работ» → «Главная» → «Акты» → «ЖР»**.
- **Шаги выполнения**:
  - [x] Найти источник порядка вкладок (`client/src/components/BottomNav.tsx`)
  - [x] Обновить порядок вкладок в UI
  - [x] Актуализировать документацию (changelog/tasktracker/project/frontend)
- **Зависимости**: Нет

---

## Задача: Генерация АОСР из JSON-шаблона (`aosr-template.json`)
- **Статус**: Завершена
- **Описание**: Перевести генерацию PDF АОСР с захардкоженного `docDefinition` на декларативный шаблон pdfmake в `server/templates/aosr/aosr-template.json`, с подстановкой плейсхолдеров и динамической таблицей материалов.
- **Шаги выполнения**:
  - [x] Добавить загрузку и кэширование `aosr-template.json` на сервере
  - [x] Реализовать рекурсивную замену плейсхолдеров `{{...}}` (даты в формате ru-RU как раньше)
  - [x] Реализовать инжект строк таблицы материалов (есть материалы / нет материалов)
  - [x] Выполнить smoke-test генерации PDF на сервере
  - [x] Обновить `/docs/changelog.md` и `/docs/project.md`
- **Зависимости**: Нет

---

## Задача: АОСР — эталонный шаблон под `005_АОСР 4.pdf` (Times New Roman, материалы/приложения текстом)
- **Статус**: Завершена
- **Описание**: Привести `server/templates/aosr/aosr-template.json` к структуре и формулировкам эталона `attached_assets/005_АОСР 4.pdf`: расширить секции/роли/подписи, вывести материалы и приложения текстом (без таблицы), подключить шрифт Times New Roman, расширить модель данных и проброс `formData` с клиента при экспорте.
- **Шаги выполнения**:
  - [x] Обновить документацию (tasktracker/changelog/project) и зафиксировать список плейсхолдеров
  - [x] Пересобрать `aosr-template.json` под порядок блоков эталона (табличная верстка бланков, hint-строки)
    - [x] Перенос строки в заголовке “Застройщик... оператор:” как в эталоне
    - [x] П.5 “Даты”: убрано тире и выровнен блок через таблицу (без изменения формата/плейсхолдеров дат)
    - [x] Подписи: подсказка “(фамилия, инициалы) / (подпись)” выровнена табличной версткой
    - [x] `hint.fontSize` увеличен до 8 для более близкой читабельности к эталону
  - [x] Расширить `ActData` и `buildAosrPlaceholderValues()` под эталонные поля — все поля реализованы в `server/pdfGenerator.ts`
  - [x] Убрать зависимость от таблицы материалов: генерировать `p3MaterialsText` — `buildP3MaterialsText()` и `buildMaterialsTextFromMaterials()`
  - [x] Реализовать приложения строго нумерованным списком через `attachmentsText` — `buildAttachmentsText()` + `buildNumberedListText()`
  - [x] Подключить шрифт Times New Roman (TTF) в `server/fonts/` и `fontDescriptors` — TTF скопированы из Windows
  - [x] Добавить/пробросить `formData` на клиенте — все поля включая `p1Works` пробрасываются при экспорте
- **Зависимости**: Задача "Генерация АОСР из JSON-шаблона (`aosr-template.json`)"

---

## Задача: P0 — Акты из графика работ (группировка по `actNumber`)
- **Статус**: Завершена
- **Описание**: Перевести создание актов на график работ: добавить в `schedule_tasks` поле принадлежности к акту (`actNumber`), формировать/обновлять записи `acts` по группировке задач графика и вычислять даты/состав работ автоматически. Примечание: после обновления кода нужно применить изменения схемы БД командой `npm run db:push` (drizzle-kit спросит подтверждение на добавление unique constraint).
- **Шаги выполнения**:
  - [x] Зафиксировать правила расчёта: `dateStart=min(startDate)`, `dateEnd=max(startDate+durationDays)`, “дата составления”=`dateEnd`, `worksData` агрегируется по `workId`, quantity берётся из `works.quantityTotal`
  - [x] DB: добавить `schedule_tasks.act_number` (nullable) + индекс `(schedule_id, act_number)`
  - [x] DB: добавить `acts.act_number` (unique, глобальный номер акта), сохранить `acts.id` как тех. ключ
  - [x] Shared: расширить `PATCH /api/schedule-tasks/:id` полем `actNumber`, добавить `POST /api/schedules/:id/generate-acts`
  - [x] Backend: реализовать upsert актов по `actNumber` и генерацию актов из графика (кнопка)
  - [x] Frontend: добавить колонку/поле `actNumber` на экране `/schedule` + отправка patch
  - [x] Frontend: обновить `/acts` — отображать `actNumber`, добавить кнопку «Сформировать/обновить из графика»
  - [x] Export PDF: дефолт `actNumber` брать из `act.actNumber`, дефолт `actDate` — из `act.dateEnd`; обновить docs/changelog/project
- **Зависимости**: Модуль “График работ” (Schedule/Gantt) (P1-4)

## Задача: P0 — синхронизация обработки сообщений (API `POST /api/messages/:id/process`)
- **Статус**: Завершена
- **Описание**: Привести в соответствие API-контракт и серверную реализацию обработки сообщений о работах. Цель — чтобы фронт мог “допроцессить” сообщение и получить нормализованные данные.
- **Шаги выполнения**:
  - [x] Реализовать `POST /api/messages/:id/process` в `server/routes.ts`
  - [x] Выделить общую функцию AI-нормализации (чтобы не дублировать код между `create` и `process`)
  - [x] Обновить `/docs/project.md` (коротко: фактический статус эндпоинта)
  - [x] Обновить `/docs/changelog.md` по факту изменений
- **Зависимости**: Задача "Описание проекта и перечень улучшений"

---

## Задача: P0-2 — безопасный импорт ВОР (без авто-удаления данных)
- **Статус**: Завершена
- **Описание**: Убрать опасное поведение “импорт = очистить всё”, сделать импорт безопасным по умолчанию (объединение/апдейт), и сократить количество запросов при загрузке ВОР.
- **Шаги выполнения**:
  - [x] Добавить API `POST /api/works/import` (bulk import) на сервере
  - [x] Обновить `shared/routes.ts` (контракт) и фронтовые хуки под импорт
  - [x] Обновить UI импорта в `client/src/pages/Works.tsx`: убрать авто `DELETE /api/works`, перейти на bulk import
  - [x] Обновить `/docs/project.md` и `/docs/changelog.md` по факту изменений
- **Зависимости**: Нет

---

## Задача: P0-3 — защита опасных эндпоинтов (удаление ВОР)
- **Статус**: Завершена
- **Описание**: Исключить возможность случайного удаления всей ВОР в production. `DELETE /api/works` должен быть недоступен в prod (или защищён отдельным флагом/ролью).
- **Шаги выполнения**:
  - [x] Ограничить `DELETE /api/works` на сервере: в production доступен только при явном подтверждении через query `resetSchedule=1`
  - [x] Обновить `/docs/project.md` (описать ограничения)
  - [x] Обновить `/docs/changelog.md` по факту изменений
- **Зависимости**: Нет

---

## Задача: ВОР — очистка с предупреждением и сбросом графика/актов (вариант A)
- **Статус**: Завершена
- **Описание**: Добавить возможность очищать ВОР (справочник работ) на вкладке `/works` с предупреждением пользователю. При подтверждении должны быть удалены задачи графика работ, если график использует ВОР как источник, и очищены списки работ в затронутых актах. Источник графика остаётся «ВОР», после чего пользователь может импортировать новый ВОР или выбрать другой источник на `/schedule`.
- **Шаги выполнения**:
  - [x] Backend: `DELETE /api/works?resetSchedule=1` — сбросить schedule_tasks и acts.worksData для графиков с `sourceType='works'`, затем очистить `works`
  - [x] Backend: `DELETE /api/works` без `resetSchedule` — вернуть `409`, если ВОР используется графиком
  - [x] Frontend: UI `/works` — кнопка «Очистить ВОР» с предупреждением и подтверждением
  - [x] Frontend: `useClearWorks` — вызов с `resetSchedule=1` + инвалидация кэша (works/schedules/acts)
  - [x] Документация: обновить `docs/changelog.md`, `docs/project.md`, `docs/tasktracker.md`
- **Зависимости**: `server/storage.ts`, `server/routes.ts`, `shared/routes.ts`, `client/src/hooks/use-works.ts`, `client/src/pages/Works.tsx`

---

## Задача: Документы — исправить runtime ошибку Select на /source/documents
- **Статус**: Завершена
- **Описание**: На странице `/source/documents` в фильтрах использовался `SelectItem value=\"\"`, что запрещено Radix Select и вызывает runtime overlay. Нужно заменить на непустое значение и сохранить семантику «Все» (без фильтра).
- **Шаги выполнения**:
  - [x] Найти `SelectItem value=\"\"` в `client/src/pages/SourceDocuments.tsx`
  - [x] Заменить на `value=\"__all__\"` и маппить `__all__ → undefined` при вызове `useDocuments`
  - [x] Проверить TypeScript: `npm run check`
- **Зависимости**: `client/src/pages/SourceDocuments.tsx`, `client/src/hooks/use-documents.ts`

---

## Задача: Создание ветки для документации проекта на GitHub
- **Статус**: Завершена
- **Описание**: Создать ветку `preparation-of-project-documentation-in-cursor` на GitHub и отправить туда документацию проекта.
- **Шаги выполнения**:
  - [x] Проверка статуса репозитория и remotes
  - [x] Проверка больших файлов (>95MB)
  - [x] Обновление `.gitignore` (добавлен `.cursor/`)
  - [x] Создание ветки `preparation-of-project-documentation-in-cursor` от `main`
  - [x] Коммит документации (`docs/`) и обновленного `.gitignore`
  - [x] Push ветки на GitHub
- **Зависимости**: Задача "Описание проекта и перечень улучшений"

---

## Задача: Описание проекта и перечень улучшений
- **Статус**: Завершена
- **Описание**: Провести обзор репозитория, сформировать описание проекта и составить список возможных улучшений/расширений возможностей.
- **Шаги выполнения**:
  - [x] Аудит ключевых модулей (frontend/backend/shared, БД, AI-интеграции)
  - [x] Подготовить `/docs/project.md` (архитектура, потоки данных, env, команды)
  - [x] Подготовить `/docs/improvements.md` (улучшения с приоритетами P0/P1/P2)
  - [x] Обновить `/docs/changelog.md`
- **Зависимости**: Нет

---

## План работ для ветки `main` (одна ветка, “всё по порядку”)
**Правило**: работаем последовательно в `main`, но фиксируем маленькими коммитами “по шагам”, чтобы откат/поиск регрессий был простым.

**Критерий перехода к следующей задаче**: текущая задача закрыта, документация обновлена (`/docs/project.md` + `/docs/changelog.md` при необходимости), `npm run check` не ухудшен (или запланирован отдельный шаг на исправление).

---

## Задача: P1-1 — единый гейт для деструктивных операций (prod только по env-флагу)
- **Статус**: Запланирована
- **Описание**: Ввести единое правило: в dev деструктивные операции разрешены, в production — только при явном `ALLOW_DESTRUCTIVE_ACTIONS=true`.
- **Шаги выполнения**:
  - [ ] Добавить `ALLOW_DESTRUCTIVE_ACTIONS` (env) и единый helper/функцию “можно ли деструктивно”
  - [ ] Перевести под гейт:
    - [ ] `DELETE /api/works`
    - [ ] `POST /api/works/import` с `mode=replace`
    - [ ] demo-seed (согласовать логику с `ENABLE_DEMO_SEED`)
  - [ ] Обновить `/docs/project.md` (описать `ALLOW_DESTRUCTIVE_ACTIONS` и поведение)
  - [ ] Обновить `/docs/changelog.md`
- **Acceptance Criteria**:
  - [ ] В production без `ALLOW_DESTRUCTIVE_ACTIONS=true` все destructive операции запрещены/недоступны
  - [ ] В dev поведение предсказуемое и документировано
- **Зависимости**: Нет

---

## Задача: P1-2 — перенести “конституцию БД” в обычные docs (не зависеть от `.cursor/`)
- **Статус**: Запланирована
- **Описание**: Правила БД сейчас живут в `.cursor` (локально/игнорится). Нужно сделать источник истины в `docs/`, чтобы правила не терялись и были видны всем.
- **Шаги выполнения**:
  - [ ] Создать `docs/rulesdb.md` (перенести/адаптировать содержимое `.cursor/rules/rulesdb.mdc`)
  - [ ] Добавить ссылку на `docs/rulesdb.md` в `docs/project.md`
  - [ ] Обновить `/docs/changelog.md`
- **Acceptance Criteria**:
  - [ ] Правила БД доступны в репозитории и не зависят от Cursor-настроек
- **Зависимости**: P1-1 (желательно, но не строго)

---

## Задача: P1-3 — привести `npm run check` (tsc) в зелёное состояние
- **Статус**: Запланирована
- **Описание**: Сейчас `tsc` падает из-за рассинхрона типов/модулей (хуки, chat-интеграция, pdfmake типы). Нужно вернуть “зелёную” типизацию.
- **Шаги выполнения**:
  - [ ] Исправить импорты/типы в `client/src/hooks/*` (создать/экспортировать нужные типы или убрать устаревшие)
  - [ ] Привести `server/replit_integrations/chat/*` в консистентное состояние со схемой БД (или изолировать, чтобы не ломало сборку)
  - [ ] Исправить типы `pdfmake` (корректный импорт/типы, чтобы `tsc` не падал)
  - [ ] Зафиксировать результат в `/docs/changelog.md`
- **Acceptance Criteria**:
  - [ ] `npm run check` проходит без ошибок
- **Зависимости**: P1-1 (не строго), P1-2 (не обязательно)

---

## Задача: Документация — перенести правила работы ассистента из `.cursor` в `docs/`
- **Статус**: Завершена
- **Описание**: Сохранить правила взаимодействия с ассистентом (документирование, процесс, качество, шаблон заголовка файлов) в публичной документации репозитория, чтобы они не зависели от `.cursor/`.
- **Шаги выполнения**:
  - [x] Создать `/docs/cursor-assistant-rules.md` и перенести содержимое из `.cursor/skills/cursorrules/SKILL.md`
  - [x] Добавить ссылку на документ в `/docs/project.md`
  - [x] Обновить `/docs/changelog.md`
- **Зависимости**: Нет

---

## Задача: Документация — сохранить чеклист пуша на GitHub в репозитории
- **Статус**: Завершена
- **Описание**: Сохранить `.cursor/rules/github-push.mdc` в GitHub-репозитории (несмотря на общий игнор `.cursor/`), чтобы чеклист был доступен из кода.
- **Шаги выполнения**:
  - [x] Обновить `.gitignore`: игнорировать `.cursor/**`, но разрешить `.cursor/rules/github-push.mdc`
  - [x] Добавить `.cursor/rules/github-push.mdc` в индекс git
  - [x] Обновить `/docs/changelog.md`
- **Зависимости**: Нет

---

## Задача: P1-4 — модуль “График работ” (Schedule/Gantt) по `docs/techspec_schedule.md`
- **Статус**: Завершена
- **Описание**: Реализовать schedule-модуль согласно техспеке: дефолтный график, bootstrap задач из ВОР, обновление задач и UI `/schedule`. MVP без drag&drop: редактирование через диалог и быстрый сдвиг кнопками (-1/+1 день).
- **Шаги выполнения**:
  - [x] DB: добавить таблицы `schedules`, `schedule_tasks` + индексы/ограничения (Drizzle schema)
  - [x] Shared: расширить `shared/routes.ts` (контракт API schedule)
  - [x] Backend: реализовать роуты + storage (bootstrap идемпотентный, транзакции, сортировка по `orderIndex`)
  - [x] Frontend: добавить страницу `/schedule` (плейсхолдер) и подключить в навигацию (вместо “Настройки”), i18n
  - [x] UI: перенести “Настройки” из `BottomNav` в выпадающее меню “гамбургера” в `Header`
  - [x] Обновить `/docs/changelog.md` и `/docs/project.md` по факту реализации schedule-модуля
- **Acceptance Criteria (smoke-test)**:
  - [x] Импортировать ВОР → открыть `/schedule` → bootstrap → отредактировать задачу → перезагрузить → изменения сохранены
- **Зависимости**: P1-3 (желательно, чтобы ветка была “зелёной” до фичи)
---

## Задача: Раздел 3 — привести дизайн таблицы к стилю раздела 2 (UI)
- **Статус**: Завершена
- **Описание**: Обновить оформление таблицы раздела 3 на странице журнала работ так, чтобы оно совпадало по визуальному стилю с разделом 2 (рамки `border-foreground`, курсивные заголовки, без синей “темы”).
- **Шаги выполнения**:
  - [x] Найти текущую вёрстку разделов 2 и 3 в `client/src/pages/WorkLog.tsx`
  - [x] Убрать синие границы/заливки у таблицы раздела 3 и унифицировать классы `th/td` под стиль раздела 2
  - [x] Обновить `/docs/changelog.md`
- **Зависимости**: Нет

---

## Задача: Раздел 3 — inline-редактирование с draft-состоянием (подход 2 Имеет смысл, если в будущем будет одновременная работа нескольких пользователей и нужно видеть чужие обновления, не теряя свои черновики)
- **Статус**: Не начата
- **Приоритет**: Низкий
- **Описание**: Улучшить inline-редактирование сегментов сообщений в разделе 3: хранить редактируемый текст в отдельном локальном состоянии (draft), независимом от серверных данных. Это позволит видеть обновления от других пользователей (или из polling) без потери текущего черновика при редактировании.
- **Шаги выполнения**:
  - [ ] **Frontend**: добавить отдельный state для draft-сегмента (`editingDraft: { sourceId, text } | null`)
  - [ ] **Frontend**: при рендере ячейки проверять `editingDraft?.sourceId === seg.sourceId` → показывать textarea с `editingDraft.text`
  - [ ] **Frontend**: при клике на сегмент → `setEditingDraft({ sourceId: seg.sourceId, text: seg.text })`
  - [ ] **Frontend**: при изменении textarea → обновлять `editingDraft.text` (не трогая `rows` из серверного состояния)
  - [ ] **Frontend**: при сохранении → `patchMessage({ id, data })` → после успеха `setEditingDraft(null)` → polling подтянет обновлённые данные
  - [ ] **Frontend**: при отмене → `setEditingDraft(null)` без отправки на сервер
  - [ ] **Frontend**: polling (`useSection3`) работает всегда (не отключается), но textarea привязан к `editingDraft`, а не к `rows`
  - [ ] **UX**: при изменении серверных данных (polling) текст в других сегментах обновляется, но редактируемый сегмент остаётся с draft-текстом
  - [ ] **Smoke-test**: открыть две вкладки → в первой редактировать сегмент → во второй изменить другой сегмент → в первой вкладке draft не сбрасывается, но изменения из второй вкладки видны
- **Зависимости**: «Раздел 3: inline-редактирование сегментов сообщений» (завершена)

---

## Задача: Убрать зависимость db:migrate от tsx в проде
- **Статус**: Завершена
- **Описание**: `db:migrate` запускал `tsx script/db-migrate.ts`, а `tsx` находится в `devDependencies` → в production-образе (без devDependencies) миграция падала с ошибкой `tsx: not found`. Реализован вариант A: мигратор компилируется esbuild в `dist/db-migrate.cjs`.
- **Варианты решения**:
  - **Вариант A (выбран)**: компилировать мигратор — на этапе build компилировать `script/db-migrate.ts` → `dist/db-migrate.cjs`, в `package.json` заменить скрипт на `"db:migrate": "node dist/db-migrate.cjs"`
  - **Вариант B**: переписать мигратор на JS — создать `script/db-migrate.js` (чистый Node.js, без TypeScript), `"db:migrate": "node script/db-migrate.js"`
- **Шаги выполнения (вариант A)**:
  - [x] Изучить текущий `script/db-migrate.ts`: зависимости, импорты, логику
  - [x] Добавить шаг компиляции мигратора в `build`-скрипт (`script/build.ts`) через esbuild
  - [x] Обновить `package.json`: `"db:migrate": "node dist/db-migrate.cjs"`
  - [x] Проверить: `npm run build` успешно генерирует `dist/db-migrate.cjs` (183.7kb)
  - [x] Обновить документацию (`docs/changelog.md`, `docs/tasktracker.md`)
- **Acceptance Criteria**:
  - [x] `npm run build` включает компиляцию мигратора — `dist/db-migrate.cjs` создаётся
  - [x] Скрипт `db:migrate` не требует `tsx` — использует `node dist/db-migrate.cjs`
- **Зависимости**: `script/db-migrate.ts`, `package.json`, `script/build.ts`

---

## Задача: Привести миграции в консистентный вид (убрать «ложные» комментарии про drizzle push)
- **Статус**: Завершена
- **Описание**: В SQL-миграциях встречаются комментарии, утверждающие, что «primary schema sync = drizzle-kit push», но политика проекта запрещает `db:push` — единственный способ изменения БД в проде — SQL-миграции. Нужно привести комментарии в соответствие с реальной политикой.
- **Шаги выполнения**:
  - [x] Найти все SQL-миграции с упоминанием `drizzle-kit push` или `db:push` (файлы `0001`, `0002`, `0005` и др.)
  - [x] Обновить комментарии: заменить утверждения о push на корректные формулировки, например: «Единственный способ изменения БД — SQL-миграции. drizzle-kit используется только для генерации миграций (`drizzle-kit generate`)»
  - [x] Проверить, что сами SQL-команды в миграциях не изменились (только комментарии)
  - [x] Убедиться, что в репо нет других мест (README, docs, scripts), где push описан как основной способ синка схемы — исправлены `setup-db.sh` и `replit.md`
  - [x] Обновить документацию (`docs/changelog.md`)
- **Acceptance Criteria**:
  - [x] В репозитории нет утверждений, что `drizzle-kit push` — основной/рекомендуемый способ синхронизации схемы БД
  - [x] Комментарии в миграциях корректно описывают политику: «миграции — единственный путь»
- **Зависимости**: `migrations/0001_*.sql`, `migrations/0002_*.sql`, `migrations/0005_*.sql` и прочие

---

## Задача: Зафиксировать «с нуля» сценарий в документации + CI-проверка миграций
- **Статус**: Завершена
- **Описание**: Ошибки миграций всплывают только при чистой БД (fresh install). Нужно задокументировать сценарий bootstrap с нуля и добавить CI job, который ловит сломанные миграции на пустой БД до мержа PR.
- **Доказательство бага**: В свежей БД после старта приложения в Postgres-логах: `ERROR: relation "works" does not exist`. В БД нет таблиц: `\dt` → «Did not find any relations». `npm run db:migrate` не может выполниться в prod-образе, потому что `tsx: not found`. SQL-миграции содержат ссылки на `acts`/`works`, но не содержат их создания.
- **Шаги выполнения**:
  - [x] **Документация**: создан `docs/bootstrap.md` с пошаговым сценарием «Bootstrap с нуля»:
    - Поднять Postgres (Docker или вручную)
    - Создать `.env` с `DATABASE_URL`
    - `npm run build` + `npm run db:migrate`
    - Проверить: `\dt` показывает все таблицы, контрольные SELECT
  - [x] **CI job** (GitHub Actions): создан `.github/workflows/test-migrations.yml`:
    - Поднимает чистый Postgres через `services: postgres`
    - Устанавливает зависимости (`npm ci`)
    - Собирает проект (`npm run build`) — компилирует `dist/db-migrate.cjs`
    - Запускает `npm run db:migrate`
    - Проверяет наличие 9 ключевых таблиц через SELECT … LIMIT 0
    - Проверяет совпадение числа SQL-файлов с числом записей в `schema_migrations`
  - [x] Обновлена документация (`docs/changelog.md`, `docs/tasktracker.md`)
- **Acceptance Criteria**:
  - [x] Любой PR, ломающий миграции на пустой БД, ловится CI (job падает)
  - [x] В документации описан пошаговый сценарий «с нуля»
- **Зависимости**: «Убрать зависимость db:migrate от tsx в проде» (решена — `npm run build` компилирует мигратор)

---

## Задача: (Опционально) Сделать безопасный «инициализатор» только для dev/local
- **Статус**: Завершена
- **Описание**: Если `drizzle-kit` нужен для dev-генерации миграций, создать отдельные скрипты с явным разделением: `generate` (генерация SQL из схемы) vs `migrate` (применение SQL к БД). `drizzle-kit push` не должен использоваться в production.
- **Шаги выполнения**:
  - [x] Добавить скрипт `npm run db:generate` — обёртка `scripts/db-generate.js` над `drizzle-kit generate`, запрещает запуск при `NODE_ENV=production`
  - [x] `npm run db:push` явно запрещён: всегда завершается с ошибкой и пояснением
  - [x] Добавить в документацию (`docs/db-migrations.md`) раздел **Workflow работы с миграциями**:
    - `npm run db:generate` — генерирует новый SQL-файл миграции из изменений в `shared/schema.ts` (только dev)
    - `npm run db:migrate` — применяет SQL-миграции к БД (dev + prod)
    - `drizzle-kit push` — **запрещён** в production
  - [x] Обновить документацию (`docs/changelog.md`)
- **Acceptance Criteria**:
  - [x] В `package.json` есть явное разделение `db:generate` (dev) и `db:migrate` (prod-safe)
  - [x] `drizzle-kit push` не используется нигде как prod-команда
  - [x] Документация описывает правильный workflow работы с миграциями
- **Зависимости**: «Убрать зависимость db:migrate от tsx в проде», «Привести миграции в консистентный вид»

---

## Задача: P2

Чтобы включить настоящий Times, положи файлы:
server/fonts/TimesNewRoman.ttf
server/fonts/TimesNewRomanBold.ttf
server/fonts/TimesNewRomanItalic.ttf
server/fonts/TimesNewRomanBoldItalic.ttf

---

## Задача: Интеграция Telegram MiniApp (WebApp)
- **Статус**: Завершена
- **Описание**: Довести проект до состояния полноценного Telegram MiniApp — от подключения SDK до серверной валидации и создания бота. Без этого приложение работает как обычный SPA без привязки к Telegram.
- **Шаги выполнения**:
  - [x] **Шаг 1. Подключить Telegram WebApp SDK** — добавить `<script src="https://telegram.org/js/telegram-web-app.js">` в `client/index.html` перед `main.tsx`
  - [x] **Шаг 2. Инициализация WebApp в main.tsx** — вызвать `Telegram.WebApp.ready()` и `expand()` при старте приложения
  - [x] **Шаг 3. TypeScript-типы для Telegram WebApp** — создан файл `client/src/types/telegram.d.ts` с полными типами для Telegram WebApp API (TelegramWebApp, TelegramWebAppUser, TelegramWebAppThemeParams, MainButton, BackButton, HapticFeedback, InitData и др.)
  - [x] **Шаг 4. Хук useTelegram()** — создан React-хук `client/src/hooks/useTelegram.ts` с доступом к WebApp, user, initData, themeParams, colorScheme. Включает обработку запуска вне Telegram (mock данные для разработки) и дополнительные хелперы `useTelegramUser()`, `useTelegramTheme()`
  - [x] **Шаг 5. Применить тему Telegram к UI** — создан компонент `TelegramThemeProvider` для автоматического применения темы Telegram. Добавлены CSS-переменные Telegram (`--tg-theme-bg-color`, `--tg-theme-text-color`, `--tg-theme-button-color` и др.) в `index.css`. Реализована поддержка автоматического переключения между светлой и темной темой на основе `colorScheme`. Добавлены утилитарные классы (`.tg-bg`, `.tg-text`, `.tg-button` и др.) для удобного использования темы Telegram в компонентах
  - [x] **Шаг 6. Серверная валидация initData** — создан middleware `server/middleware/telegramAuth.ts` для проверки подписи HMAC-SHA-256 с Bot Token; добавлена поддержка `req.telegramUser` и `req.telegramInitData`; утилита `createMockInitData()` для тестирования; документация `docs/telegram-auth-testing.md`; скрипт `scripts/generate-mock-initdata.js` для генерации mock данных
  - [x] **Шаг 7. Привязка данных к Telegram userId** — добавлено поле `telegramUserId` в таблицу `objects` (миграция `0012_add_telegram_user_id.sql`); обновлён `storage.getOrCreateDefaultObject()` для фильтрации по userId; клиент передаёт `initData` через заголовок `X-Telegram-Init-Data` (обновлён `client/src/lib/queryClient.ts`); создана утилита `client/src/lib/telegram.ts` для работы с Telegram WebApp
  - [x] **Шаг 8. Создать Telegram-бота** — создана подробная инструкция `docs/telegram-bot-setup.md` по созданию бота через @BotFather, настройке Web App URL (`/setmenubutton`), добавлен `TELEGRAM_BOT_TOKEN` в `.env` с комментариями. Инструкция включает примеры настройки menu button, inline button, дополнительные настройки бота (описание, команды, аватар) и раздел по безопасности
  - [x] **Шаг 9. (Опционально) Telegram MainButton / BackButton** — созданы React-хуки для работы с нативными кнопками Telegram:
    - `client/src/hooks/use-telegram-main-button.ts` — управление MainButton (текст, цвет, состояние, прогресс)
    - `client/src/hooks/use-telegram-back-button.ts` — управление BackButton (показать/скрыть)
    - Документация `docs/telegram-buttons-guide.md` с API хуков, примерами использования (формы, навигация, модальные окна) и best practices
  - [x] **Шаг 10. (Опционально) HapticFeedback** — создан хук `client/src/hooks/use-telegram-haptic.ts` для тактильной обратной связи:
    - Поддержка `impact` (light/medium/heavy/rigid/soft) для физических действий
    - Поддержка `notification` (success/error/warning) для результатов операций
    - Поддержка `selectionChanged` для навигации и выбора
    - Утилита `haptic` для использования вне React компонентов
    - Документация `docs/telegram-haptic-guide.md` с матрицей использования, примерами по сценариям и best practices
- **Зависимости**: нет (шаги 6–8 зависят от наличия Bot Token)
- **Примечание**: Шаги 6-7 (серверная валидация и привязка к userId) остаются для будущей реализации при необходимости многопользовательского режима

---

## Задача: Импорт материалов из счетов поставщиков (PDF → локальные материалы проекта)
- **Статус**: Завершена
- **Описание**: Добавить возможность импорта материалов из PDF-счетов поставщиков в локальный список материалов проекта. Кнопка «Добавить файл» появляется только на вкладке «Локальные» страницы `/source/materials`. PDF парсится микросервисом invoice-extractor (Python/Flask), пользователь видит предпросмотр позиций с чекбоксами и inline-редактированием, затем подтверждает импорт. Дубликаты по имени (case-insensitive) пропускаются. Партии/цены не сохраняются.
- **План**: `ai_docs/develop/plans/2026-03-01-invoice-import-materials.md`
- **Шаги выполнения**:

### Фаза 1: Инфраструктура (INV-001 + INV-002)

  **INV-001: Реструктуризация invoice-extractor в пакет `services/invoice-extractor/`**

  - [x] **INV-001-A**: Создать каталог `services/invoice-extractor/app/` с `__init__.py`
  - [x] **INV-001-B**: Скопировать 5 Python-модулей в пакет `app/`:
    - `extractor.py` → `services/invoice-extractor/app/extractor.py` (импортирует `app.llm_client`, `app.normalizer`)
    - `llm_client.py` → `services/invoice-extractor/app/llm_client.py` (без внутренних импортов)
    - `normalizer.py` → `services/invoice-extractor/app/normalizer.py` (без внутренних импортов)
    - `validators.py` → `services/invoice-extractor/app/validators.py` (без внутренних импортов)
    - `excel_builder.py` → `services/invoice-extractor/app/excel_builder.py` (без внутренних импортов)
  - [x] **INV-001-C**: Скопировать файлы верхнего уровня (без изменений — импорты из `app.` уже корректны):
    - `run.py` → `services/invoice-extractor/run.py`
    - `requirements.txt` → `services/invoice-extractor/requirements.txt`
    - `gunicorn.conf.py` → `services/invoice-extractor/gunicorn.conf.py`
    - `.env.example` → `services/invoice-extractor/.env.example`
  - [x] **INV-001-D**: Обновить `Dockerfile` — скопировать и адаптировать:
    - WORKDIR `/app` (оставляем — Python package `app/` будет в `/app/app/`, `from app.extractor` найдёт `/app/app/extractor.py` через CWD в sys.path)
    - Добавить `curl` в `apt-get install` для healthcheck
    - Итоговая структура внутри контейнера:
      ```
      /app/
      ├── run.py
      ├── gunicorn.conf.py
      ├── requirements.txt
      └── app/
          ├── __init__.py
          ├── extractor.py
          ├── llm_client.py
          ├── normalizer.py
          ├── validators.py
          └── excel_builder.py
      ```
  - [x] **INV-001-E**: Создать `services/invoice-extractor/.dockerignore` (исключить `__pycache__`, `.env`, `uploads/`, `outputs/`, `.git`)
  - [x] **INV-001-F**: Проверить сборку: `docker build -t invoice-extractor services/invoice-extractor/`

  **Критерии приёмки INV-001:**
  - `docker build` проходит без ошибок
  - Внутри контейнера `python -c "from app.extractor import extract_invoice; print('OK')"` — успешно
  - `testFiles/files_invoice-extractor/` остаётся без изменений (старая копия)

  **INV-002: Docker Compose — сервис invoice-extractor**

  - [x] **INV-002-A**: Создать `docker-compose.yml` в корне проекта:
    - Сервис `invoice-extractor`:
      - `build.context`: `./services/invoice-extractor`
      - `ports`: `5050:5000` (внешний 5050, внутренний 5000)
      - `environment`: LLM_PROVIDER, ANTHROPIC_API_KEY, OPENAI_API_KEY, MAX_FILE_SIZE_MB, MAX_PAGES, REQUEST_TIMEOUT_SEC (через `${VAR:-default}` из `.env`)
      - `restart`: `unless-stopped`
      - `healthcheck`: `curl -f http://localhost:5000/health` (interval 30s, timeout 10s, retries 3)
    - Сеть: default bridge (для dev — доступ по `localhost:5050`)
  - [x] **INV-002-B**: Добавить переменную `INVOICE_EXTRACTOR_URL` в `.env` корня проекта:
    - Для dev: `INVOICE_EXTRACTOR_URL=http://localhost:5050`
    - Для Docker-сети: `INVOICE_EXTRACTOR_URL=http://invoice-extractor:5000`
  - [x] **INV-002-C**: Проверить: `docker run -p 5050:5000 invoice-extractor` → `curl http://localhost:5050/health` → `{"status": "ok", "version": "1.0.0"}` ✓
    - Примечание: `docker compose` plugin не установлен, использован `docker run` для верификации; `docker-compose.yml` корректен для docker compose v2

  **Критерии приёмки INV-002:**
  - `docker compose up invoice-extractor` успешно стартует
  - Healthcheck проходит (`docker compose ps` показывает `healthy`)
  - `curl http://localhost:5050/health` возвращает `{"status": "ok", "version": "1.0.0"}`

### Фаза 2: Backend API (INV-003 — INV-006)

  **INV-003: Shared routes — Zod-схемы для `parseInvoice` и `bulkCreate`**

  Файл: `shared/routes.ts`, секция `projectMaterials` (после `saveToCatalog`, строка ~285, перед закрывающей `}` секции)

  - [x] **INV-003-A**: Добавить роут `parseInvoice`:
    ```
    parseInvoice: {
      method: "POST",
      path: "/api/objects/:objectId/materials/parse-invoice",
      // input пустой — файл приходит через multipart/form-data, Zod не валидирует binary
      input: z.object({}),
      responses: {
        200: z.object({
          items: z.array(z.object({
            name: z.string(),
            unit: z.string().optional().default(""),
            qty: z.union([z.number(), z.string()]).optional(),
            price: z.union([z.number(), z.string()]).optional(),
            amount_w_vat: z.union([z.number(), z.string()]).optional(),
            vat_rate: z.string().optional(),
          })),
          invoice_number: z.string().optional(),
          invoice_date: z.string().optional(),
          supplier_name: z.string().optional(),
          warnings: z.array(z.string()).optional(),
        }),
        400: z.object({ message: z.string() }),
        502: z.object({ message: z.string() }),
      },
    }
    ```
    Ключевое: `items[].name` и `items[].unit` — это то, что пойдёт в `nameOverride`/`baseUnitOverride`; `qty`, `price`, `amount_w_vat` — только для отображения в превью

  - [x] **INV-003-B**: Добавить роут `bulkCreate`:
    ```
    bulkCreate: {
      method: "POST",
      path: "/api/objects/:objectId/materials/bulk",
      input: z.object({
        items: z.array(z.object({
          nameOverride: z.string().trim().min(1),
          baseUnitOverride: z.string().trim().optional(),
        })).min(1).max(500),
      }),
      responses: {
        200: z.object({
          created: z.number().int().nonnegative(),
          skipped: z.number().int().nonnegative(),
          materials: z.array(z.custom<typeof projectMaterials.$inferSelect>()),
        }),
        400: z.object({ message: z.string() }),
      },
    }
    ```
    Ограничение `.max(500)` — защита от случайной загрузки огромного массива

  - [x] **INV-003-C**: Проверить `npm run check` — TypeScript компилируется без ошибок

  **Критерии приёмки INV-003:**
  - Типы `api.projectMaterials.parseInvoice` и `api.projectMaterials.bulkCreate` доступны из `@shared/routes`
  - Zod-схемы корректно парсят тестовые данные
  - Нет TypeScript-ошибок

  ---

  **INV-004: Storage — метод `bulkCreateProjectMaterials`**

  Файл: `server/storage.ts`

  - [x] **INV-004-A**: Добавить сигнатуру в интерфейс `IStorage` (после `saveProjectMaterialToCatalog`, строка ~153):
    ```typescript
    bulkCreateProjectMaterials(
      objectId: number,
      items: Array<{ nameOverride: string; baseUnitOverride?: string }>
    ): Promise<{ created: number; skipped: number; materials: ProjectMaterial[] }>;
    ```

  - [x] **INV-004-B**: Реализовать метод в `DatabaseStorage` (после `createProjectMaterial`, строка ~755):
    Алгоритм:
    1. Если `items.length === 0` → возврат `{ created: 0, skipped: 0, materials: [] }`
    2. Запросить существующие материалы объекта:
       ```sql
       SELECT name_override FROM project_materials
       WHERE object_id = $objectId AND deleted_at IS NULL
       ```
    3. Построить `Set<string>` из `nameOverride.trim().toLowerCase()` — для case-insensitive сравнения
    4. Дедупликация входного массива (внутренние дубли — оставляем первый):
       ```typescript
       const seen = new Set<string>();
       for (const item of items) {
         const key = item.nameOverride.trim().toLowerCase();
         if (existingNames.has(key) || seen.has(key)) { skipped++; continue; }
         seen.add(key);
         toCreate.push(item);
       }
       ```
    5. Если `toCreate.length === 0` → возврат с `skipped`
    6. Bulk insert:
       ```typescript
       const created = await db
         .insert(projectMaterials)
         .values(toCreate.map(item => ({
           objectId,
           nameOverride: item.nameOverride.trim(),
           baseUnitOverride: item.baseUnitOverride?.trim() || null,
           paramsOverride: {},
         })))
         .returning();
       ```
    7. Возврат `{ created: created.length, skipped, materials: created }`

  - [x] **INV-004-C**: Проверить edge cases:
    - Пустой массив → `{ created: 0, skipped: 0, materials: [] }`
    - Все дубликаты → `{ created: 0, skipped: N, materials: [] }`
    - Внутренние дубли: `["Кирпич", "кирпич", "КИРПИЧ"]` → создаётся 1, пропускается 2
    - Soft-deleted материалы (`deletedAt IS NOT NULL`) не считаются дубликатами

  **Критерии приёмки INV-004:**
  - Дубликаты по имени (case-insensitive, с trim) пропускаются
  - Дубликаты внутри входного массива дедуплицируются (первый побеждает)
  - Возвращает точные счётчики `created`/`skipped`
  - Soft-deleted материалы не блокируют создание новых с тем же именем

  ---

  **INV-005: Server routes — proxy-эндпоинт parse-invoice**

  Файл: `server/routes.ts` (после handler'а `projectMaterials.create`, строка ~221)

  - [ ] **INV-005-A**: Установить зависимость `multer` + типы:
    ```bash
    npm install multer @types/multer
    ```
    `multer` не установлен в проекте — нужен для приёма `multipart/form-data` с PDF-файлом

  - [ ] **INV-005-B**: Добавить импорт и настройку multer в начале `server/routes.ts`:
    ```typescript
    import multer from 'multer';
    const invoiceUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
          cb(null, true);
        } else {
          cb(new Error('Only PDF files are accepted'));
        }
      },
    });
    ```
    - `memoryStorage()` — файл хранится в RAM, не пишется на диск
    - Лимит 50 MB — совпадает с лимитом в invoice-extractor
    - Фильтр по MIME + расширению (двойная проверка)

  - [ ] **INV-005-C**: Реализовать handler:
    ```typescript
    app.post(
      api.projectMaterials.parseInvoice.path,
      invoiceUpload.single('file'),
      async (req, res) => {
        // 1. Валидация objectId
        const objectId = Number(req.params.objectId);
        if (!Number.isFinite(objectId) || objectId <= 0) {
          return res.status(400).json({ message: "Invalid objectId" });
        }
        // 2. Проверка файла
        if (!req.file) {
          return res.status(400).json({ message: "PDF file is required" });
        }
        // 3. Формирование запроса к invoice-extractor
        const extractorUrl = process.env.INVOICE_EXTRACTOR_URL || 'http://localhost:5050';
        const formData = new FormData();
        formData.append('file', new Blob([req.file.buffer], { type: 'application/pdf' }), req.file.originalname);
        formData.append('output', 'json');
        // 4. Запрос с таймаутом
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 150_000); // 2.5 мин
        try {
          const response = await fetch(`${extractorUrl}/convert`, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.error(`Invoice extractor error ${response.status}:`, errBody);
            return res.status(502).json({ message: `Invoice extractor returned ${response.status}` });
          }
          const data = await response.json();
          // 5. Маппинг ответа в нашу Zod-схему
          return res.status(200).json({
            items: (data.items || []).map((item: any) => ({
              name: String(item.name || '').trim(),
              unit: String(item.unit || '').trim(),
              qty: item.qty ?? '',
              price: item.price ?? '',
              amount_w_vat: item.amount_w_vat ?? '',
              vat_rate: item.vat_rate ?? '',
            })).filter((item: any) => item.name.length > 0),
            invoice_number: data.invoice_number || undefined,
            invoice_date: data.invoice_date || undefined,
            supplier_name: data.supplier?.name || undefined,
            warnings: data.warnings || [],
          });
        } catch (err: any) {
          clearTimeout(timeout);
          if (err.name === 'AbortError') {
            return res.status(502).json({ message: "Invoice extractor timeout" });
          }
          console.error("Invoice parse-invoice proxy error:", err);
          return res.status(502).json({ message: "Invoice extractor unavailable" });
        }
      }
    );
    ```

  - [ ] **INV-005-D**: Добавить обработку ошибки multer (файл слишком большой):
    ```typescript
    // Глобальный error handler для multer в registerRoutes или после роута
    app.use((err: any, req: any, res: any, next: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "File too large (max 50 MB)" });
        }
        return res.status(400).json({ message: err.message });
      }
      if (err.message === 'Only PDF files are accepted') {
        return res.status(400).json({ message: err.message });
      }
      next(err);
    });
    ```

  - [ ] **INV-005-E**: Добавить `INVOICE_EXTRACTOR_URL` в `.env` проекта (для dev)

  **Критерии приёмки INV-005:**
  - PDF-файл корректно проксируется в invoice-extractor через `FormData`
  - Ответ маппится в Zod-схему `parseInvoice.responses[200]`
  - Позиции с пустым `name` фильтруются
  - Ошибки extractor'а: 502 (недоступен / ошибка) с понятным сообщением
  - Таймаут: 502 через 2.5 минуты
  - Превышение размера файла: 400 «File too large»
  - Не-PDF файл: 400 «Only PDF files are accepted»
  - Файл не записывается на диск (memoryStorage)

  ---

  **INV-006: Server routes — bulk-create endpoint**

  Файл: `server/routes.ts` (после handler'а parse-invoice)

  - [ ] **INV-006-A**: Реализовать handler по паттерну существующих:
    ```typescript
    app.post(api.projectMaterials.bulkCreate.path, async (req, res) => {
      const objectId = Number(req.params.objectId);
      if (!Number.isFinite(objectId) || objectId <= 0) {
        return res.status(400).json({ message: "Invalid objectId" });
      }
      try {
        const { items } = api.projectMaterials.bulkCreate.input.parse(req.body);
        const result = await storage.bulkCreateProjectMaterials(objectId, items);
        return res.status(200).json(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0].message });
        }
        console.error("Bulk create materials failed:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }
    });
    ```

  - [ ] **INV-006-B**: Проверить `npm run check` — нет TypeScript-ошибок после всех изменений

  **Критерии приёмки INV-006:**
  - Валидация `objectId` (400 если невалидный)
  - Валидация `req.body` через Zod (400 при ошибке)
  - Вызов `storage.bulkCreateProjectMaterials` — дубликаты пропускаются
  - Ответ `{ created, skipped, materials }` — точные счётчики
  - Ошибки обрабатываются (400 Zod, 500 прочие)

  ---

  **Зависимости и порядок выполнения фазы 2:**

  ```
  INV-003 (Zod-схемы) ──┬──► INV-004 (Storage) ──► INV-006 (bulk-create route)
                         │
                         ├──► INV-005 (parse-invoice route) ← зависит от INV-002 (Docker)
                         │
                         └──► INV-007 (фронтенд хуки, фаза 3)
  ```

  Параллельно можно: INV-004 + INV-005 (после завершения INV-003)
  NPM-зависимость: `multer` + `@types/multer` (INV-005-A)

### Фаза 3: Frontend (INV-007 — INV-009)

  - [x] **INV-007**: Хуки `useParseInvoice` и `useBulkCreateMaterials` в `use-materials.ts`
  - [x] **INV-008**: Компонент `InvoicePreviewDialog.tsx` (таблица, чекбоксы, inline-edit, result summary)
  - [x] **INV-009**: Компонент `InvoiceImportButton.tsx` + интеграция в `SourceMaterials.tsx` (только вкладка «Локальные»)

### Фаза 4: Финализация (INV-010)

  - [x] **INV-010**: Документация (`changelog.md`, `project.md`, `tasktracker.md`) + тестирование

### Исправления после code review

  - [x] **FIX-001**: Multer error handler - перемещён в сам роут (callback pattern)
  - [x] **FIX-002**: SSRF защита - whitelist валидация для `INVOICE_EXTRACTOR_URL`
  - [x] **FIX-003**: Memory leak - очистка `req.file.buffer` в finally block
  - [x] **FIX-004**: Rate limiting - добавлен `express-rate-limit` (10 запросов/15 мин)
  - [x] **FIX-005**: useMemo → useEffect для side effect в InvoicePreviewDialog

- **Файлы (создать)**:
  - `services/invoice-extractor/` — весь пакет (из `testFiles/files_invoice-extractor/`)
  - `services/invoice-extractor/app/__init__.py`
  - `services/invoice-extractor/app/extractor.py`
  - `services/invoice-extractor/app/llm_client.py`
  - `services/invoice-extractor/app/normalizer.py`
  - `services/invoice-extractor/app/validators.py`
  - `services/invoice-extractor/app/excel_builder.py`
  - `services/invoice-extractor/.dockerignore`
  - `docker-compose.yml`
  - `client/src/components/materials/InvoicePreviewDialog.tsx`
  - `client/src/components/materials/InvoiceImportButton.tsx`
- **Файлы (изменить)**:
  - `shared/routes.ts` — два новых эндпоинта
  - `server/storage.ts` — `bulkCreateProjectMaterials`
  - `server/routes.ts` — два новых роута
  - `client/src/hooks/use-materials.ts` — два новых хука
  - `client/src/pages/SourceMaterials.tsx` — кнопка + диалог
  - `docs/project.md`, `docs/changelog.md`, `docs/tasktracker.md`
- **Зависимости**: Docker, LLM API-ключи (Anthropic/OpenAI), пакеты NPM: `multer`, `@types/multer`

---

## Задача: Доступ в браузере + стабильная обработка сообщений
- **Статус**: Завершена
- **Описание**: Обеспечить работу приложения на production вне Telegram через отдельную авторизацию (access-token), а также убрать бесконечную “обработку” сообщений при недоступном AI/ключе OpenAI.
- **Шаги выполнения**:
  - [x] Добавить browser access-token middleware на сервере (`X-App-Access-Token` ↔ `APP_ACCESS_TOKEN`)
  - [x] Разрешить аутентификацию “Telegram или browser token” для основных user-scoped API (`/api/object/current`, `/api/messages`, `/api/worklog/section3`)
  - [x] При ошибке AI-нормализации помечать сообщение обработанным без `normalizedData` (чтобы UI не зависал)
  - [x] Добавить экран ввода токена `/login` и пункт в настройках
- **Зависимости**: `APP_ACCESS_TOKEN` в окружении production (для доступа в браузере)