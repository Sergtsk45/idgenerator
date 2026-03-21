# Task Tracker: ISS-002 `server/routes.ts` decomposition

## Контекст и цель
- **Проблема**: `server/routes.ts` содержит ~3000 строк и объединяет много доменов (objects, materials, works, estimates, messages, acts, schedule, admin, voice, tariff).
- **Цель**: перейти к модульной структуре `server/routes/*` с явной регистрацией `register*Routes(app)`.
- **Ожидаемый эффект**: проще навигация и review, меньше merge-конфликтов, безопаснее параллельная разработка.
- **Принцип миграции**: поведение и контракты API не менять в фазе декомпозиции (только перенос кода и связанного локального helper-кода).

## Baseline
- [x] `npm run check` перед стартом миграции — **OK** (TypeScript без ошибок)
- [x] Зафиксировать baseline-коммит/тег перед переносом модулей

---

## Выявленные корректировки к исходному плану (чтобы не было перекосов)

1. **Admin endpoints в реальном коде шире**, чем в исходном списке:
   - есть `GET /api/admin/stats`
   - есть `GET /api/admin/messages/failed`
   - есть `POST /api/admin/messages/:id/reprocess`
   - есть `POST/PATCH/DELETE /api/admin/materials-catalog`
   - есть `GET /api/admin/admins`
   - плюс `POST /api/admin/materials-catalog/import`, `PATCH /api/admin/users/:id/tariff`, и операции блокировки/ролей.

2. **Acts/Schedule связаны сильнее, чем выглядит из плана**:
   - `POST /api/schedules/:id/generate-acts` должен жить в `schedule.ts`, но плотно использует act-структуру.
   - `GET /api/act-templates`, `POST /api/acts/:id/export`, `GET /api/pdfs/:filename`, `POST /api/acts/create-with-templates` фактически относятся к `acts.ts`.

3. **Schedule endpoints в реальном коде включают дополнительные ветки**, которых нет в исходном списке:
   - `GET /api/schedules/:id/source-info`
   - `POST /api/schedules/:id/change-source`
   - `POST /api/schedules/:id/bootstrap-from-works`
   - `POST /api/schedules/:id/bootstrap-from-estimate`

4. **Task materials** — отдельный блок в `schedule`-домене:
   - list/replace/add/remove (`GET/PUT/POST/DELETE`) для task-materials.

5. **Нельзя “потерять” middleware/лимитеры при переносе**:
   - `voiceRateLimiter`, `invoiceParseRateLimiter`, `requireFeature`, `requireQuota`, `multer`-конфиги должны остаться в тех модулях, где используются.

---

## План выполнения

## Фаза 0: Подготовка (30-45 мин)
- **Статус**: Завершена
- **Описание**: подготовить shared-механику и безопасный каркас для поэтапного переноса.
- **Шаги**:
  - [x] Создать `server/routes/_common.ts`
  - [x] Вынести и экспортировать:
    - `storage` (из `server/storage.ts`)
    - `appAuth` (`[authMiddleware({ required: true })]`)
    - `adminAuth` (`[authMiddleware({ required: true }), requireAdmin]`) или `requireAdmin` + `authMiddleware`
    - `resolveCurrentObject` (из `server/middleware/objectAccess.ts`)
    - `getObjectId(req): number | null` (из `req.currentObjectId`, `req.params.objectId`, `req.body.objectId`)
    - `handleError(res, err, fallbackMessage?)`
    - тип `AuthenticatedRequest` (`Request & { user: NonNullable<Request["user"]> }`)
  - [x] Проверить, что новые helpers не меняют текущий HTTP-контракт
  - [x] `npm run check`
- **Критерий готовности**: `_common.ts` готов, код компилируется.

---

## Фаза 1: Поэтапный вынос модулей (один модуль = один коммит)

## Задача 1.1: `server/routes/admin.ts` (20-35 мин)
- **Статус**: Завершена
- **Шаги**:
  - [x] Перенести все `"/api/admin/*"` endpoints:
    - users list/block/unblock/make-admin/remove-admin
    - tariff change
    - stats
    - admins list
    - failed messages + reprocess
    - materials-catalog CRUD + import
  - [x] Импортировать auth/admin middleware из `_common.ts`
  - [x] Экспортировать `registerAdminRoutes(app)`
  - [x] Подключить модуль из `server/routes.ts`
  - [x] `npm run check`
- **Риск**: разные HTTP методы (`POST` vs `PATCH` vs `DELETE`) на похожих путях.

## Задача 1.2: `server/routes/messages.ts` (20-35 мин)
- **Статус**: Завершена
- **Шаги**:
  - [x] Перенести messages endpoints:
    - clear/list/create/patch/process
  - [x] Перенести `GET /api/worklog/section3`
  - [x] Перенести `normalizeWorkMessage` + `getOpenAIClient` в модуль/утилиту
  - [x] Экспортировать `registerMessageRoutes(app)`
  - [x] Подключить модуль в диспетчере
  - [x] `npm run check`
- **Риск**: не потерять owner-check (`message.userId === req.user!.id`).

## Задача 1.3: `server/routes/works.ts` (25-40 мин)
- **Статус**: Завершена
- **Шаги**:
  - [x] Перенести works и work-collections:
    - works list/create/import/delete
    - collections list/get/import/delete
  - [x] Сохранить текущую semantics destructive-операций (`resetSchedule`, prod guard)
  - [x] Экспортировать `registerWorksRoutes(app)`
  - [x] Подключить модуль
  - [x] `npm run check`
- **Риск**: сохранить текущее поведение без “тихого” изменения авторизации/guard-логики.

## Задача 1.4: `server/routes/estimates.ts` (25-40 мин)
- **Статус**: Завершена
- **Шаги**:
  - [x] Перенести estimates:
    - list/get/import/delete
  - [x] Перенести estimate-position-links:
    - statuses/upsert/delete
  - [x] Экспортировать `registerEstimateRoutes(app)` (или `registerEstimatesRoutes`)
  - [x] Подключить модуль
  - [x] `npm run check`
- **Риск**: `statuses` endpoint привязан к schedule context (`scheduleId`).

## Задача 1.5: `server/routes/materials.ts` (35-60 мин)
- **Статус**: Завершена
- **Шаги**:
  - [x] Перенести блок materials/documents:
    - materials-catalog search/create
    - project-materials list/create/get/patch/save-to-catalog
    - material-batches create/patch/delete
    - documents list/create
    - document-bindings create/patch/delete
    - parse-invoice, bulk-create-materials
    - invoice-corrections submit/stats
  - [x] Перенести `invoiceUpload`, `invoiceParseRateLimiter`, `ALLOWED_EXTRACTOR_URLS` и валидатор URL
  - [x] Сохранить `requireFeature('INVOICE_IMPORT')` + `requireQuota(...)`
  - [x] Экспортировать `registerMaterialsRoutes(app)`
  - [x] Подключить модуль
  - [x] `npm run check`
- **Риск**: multipart + лимитеры + blob cleanup в одном endpoint.

## Задача 1.6: `server/routes/acts.ts` (30-50 мин)
- **Статус**: Завершена
- **Шаги**:
  - [x] Перенести acts endpoints:
    - list/get/create/patch/delete (по API-контракту)
    - deprecated generate endpoint (`410`)
    - act templates
    - act template selections (если зарегистрированы в этом файле)
    - act material usages (list/replace)
    - act document attachments (list/replace)
  - [x] Перенести export и PDF-serving:
    - `POST /api/acts/:id/export`
    - `GET /api/pdfs/:filename`
    - `POST /api/acts/create-with-templates` (deprecated `410`)
  - [x] Локализовать импорты из `pdfGenerator`
  - [x] Экспортировать `registerActsRoutes(app)`
  - [x] Подключить модуль
  - [x] `npm run check`
- **Риск**: не сломать fallback-логику шаблонов и генерацию PDF.

## Задача 1.7: `server/routes/schedule.ts` (40-70 мин)
- **Статус**: Завершена
- **Шаги**:
  - [x] Перенести schedule endpoints:
    - default/create/get
    - bootstrap-from-works
    - bootstrap-from-estimate
    - source-info/change-source
    - generate-acts
  - [x] Перенести schedule-tasks:
    - patch, split, split-siblings
  - [x] Перенести task-materials:
    - list/replace/add/remove
  - [x] Перенести schedule helper-функции дат (`addDaysISO`, `differenceInDaysISO`, `eachDayInRange`) если используются только здесь
  - [x] Экспортировать `registerScheduleRoutes(app)`
  - [x] Подключить модуль
  - [x] `npm run check`
- **Риск**: высокая связность и много бизнес-правил (act template sync, split sync).

## Задача 1.8: `server/routes/objects.ts` (15-30 мин)
- **Статус**: Завершена
- **Шаги**:
  - [x] Перенести object/current + source-data endpoints
  - [x] Перенести objects CRUD + select
  - [x] Сохранить quota checks по objects
  - [x] Экспортировать `registerObjectRoutes(app)`
  - [x] Подключить модуль
  - [x] `npm run check`

## Задача 1.9: `server/routes/voice.ts` (10-20 мин)
- **Статус**: Завершена
- **Шаги**:
  - [x] Перенести voice endpoint
  - [x] Перенести `voiceUpload` + `voiceRateLimiter`
  - [x] Экспортировать `registerVoiceRoutes(app)`
  - [x] Подключить модуль
  - [x] `npm run check`

## Задача 1.10: `server/routes/tariff.ts` (10-20 мин)
- **Статус**: Завершена
- **Шаги**:
  - [x] Перенести `GET /api/tariff/status`
  - [x] Сохранить логику quotas (`objects`, `invoiceImports`)
  - [x] Экспортировать `registerTariffRoutes(app)`
  - [x] Подключить модуль
  - [x] `npm run check`

---

## Фаза 2: Новый `server/routes.ts` как диспетчер (15-25 мин)
- **Статус**: Не начата
- **Шаги**:
  - [ ] Оставить только orchestrator-логику:
    - imports `register*Routes`
    - функция `registerRoutes(httpServer, app)` и последовательный вызов регистраций
    - `return httpServer`
  - [ ] Проверить совместимость сигнатуры с `server/index.ts`
  - [ ] Удалить неиспользуемые импорты/утилиты из старого `routes.ts`
  - [ ] `npm run check`
- **Критерий готовности**: `routes.ts` 30-70 строк, без бизнес-логики.

---

## Фаза 3: Верификация (30-45 мин)
- **Статус**: Не начата
- **Шаги**:
  - [ ] `npm run check`
  - [ ] `npm run build`
  - [ ] Smoke-test:
    - [ ] Auth (Telegram + email)
    - [ ] Objects CRUD + select current
    - [ ] Materials list/create + parse invoice
    - [ ] Schedules tasks + split
    - [ ] Generate acts + export PDF + `/api/pdfs/:filename`
    - [ ] Admin users + tariffs + materials-catalog import
  - [ ] Проверка middleware parity:
    - [ ] `appAuth` / `adminAuth`
    - [ ] `requireFeature` / `requireQuota`
    - [ ] rate limiters
    - [ ] multer upload filters/limits
- **Критерий готовности**: поведение API совпадает с baseline.

---

## Фаза 4: Документация и закрытие ISS-002 (15-30 мин)
- **Статус**: Не начата
- **Шаги**:
  - [ ] Обновить `docs/project.md` (структура backend routes)
  - [ ] Добавить запись в `docs/changelog.md`
  - [ ] Обновить `docs/tasktracker.md` (статус ISS-002)
  - [ ] Закрыть ISS-002 в `ai_docs/develop/issues/`
- **Критерий готовности**: код и документация синхронизированы.

---

## Рекомендуемый порядок коммитов
1. `refactor(routes): add shared route common helpers`
2. `refactor(routes): extract admin routes module`
3. `refactor(routes): extract messages routes module`
4. `refactor(routes): extract works routes module`
5. `refactor(routes): extract estimates routes module`
6. `refactor(routes): extract materials routes module`
7. `refactor(routes): extract acts routes module`
8. `refactor(routes): extract schedule routes module`
9. `refactor(routes): extract objects routes module`
10. `refactor(routes): extract voice routes module`
11. `refactor(routes): extract tariff routes module`
12. `refactor(routes): slim main routes dispatcher`
13. `docs(routes): update backend routes architecture and tracker`

---

## Контрольный чеклист качества
- [ ] Корректность: маршруты и коды ответов не изменены
- [ ] Безопасность: не ослаблены auth/admin/feature/quota проверки
- [ ] Производительность: не добавлены лишние запросы к БД
- [ ] Поддержка: каждый модуль имеет единый `register*Routes(app)` и локальные зависимости
- [ ] Документация: `project/changelog/tasktracker/issues` обновлены

---

## Git workflow для ISS-002
- [ ] Пушить изменения только в `origin/refactor/routes-modularization`
- [ ] PR создавать только по отдельному запросу Сергея
- [ ] Синхронизацию с `main` и `feature/tablet-ui` выполнять только по отдельному запросу Сергея
