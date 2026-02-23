# Changelog

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

