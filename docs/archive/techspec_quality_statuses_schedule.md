# TechSpec: Статусы документов качества в графике работ (по подстрокам сметы)
Дата: 2026-02-02  
Автор: AI‑агент (по запросу Сергея)

## Контекст и цель

Сейчас:
- Источник состава работ/подстрок: **Смета (ЛСР)** (`estimates → estimate_positions`).
- Источник план‑факт и актирования: **График работ** (`schedules → schedule_tasks`, где задачи указывают `estimatePositionId` для основных позиций).
- Источник факта наличия/валидности документов: **Реестр документов и привязок** (`documents`, `document_bindings`).
- В UI `/schedule` подстроки при раскрытии — это **вспомогательные позиции сметы** (те, что не ГЭСН/ФЕР/ТЕР), т.е. записи `estimate_positions`.

Нужно:
- На экране `/schedule` для подстрок (`estimate_positions`) показывать **статус документов качества** для визуального контроля (например: нет / частично / ок).
- Привязка документов должна быть **детерминированной**, без “угадывания по названию”.

Ключевой принцип:
- **График — витрина и место управления**, но “истина” по документам остаётся в `documents`/`document_bindings`.  
  График хранит только **ссылки/привязки**, а статусы **вычисляются**.

---

## Термины

- **Основная позиция сметы**: строка `estimate_positions`, код которой начинается с ГЭСН/ФЕР/ТЕР (она превращается в задачу графика).
- **Вспомогательная позиция (подстрока)**: строка `estimate_positions`, которая идёт “под” основной и отображается раскрываемой подстрокой (ФСБЦ, прайс, оборудование, комплектующие и т.п.).
- **Материал проекта**: `project_materials` (объектный контекст).
- **Партия материала**: `material_batches` (опционально на MVP).
- **Привязка документа**: `document_bindings`, где `bindingRole='quality'` и флаг `useInActs` определяет применимость в актах.

---

## MVP: подробное внедрение (реализация “быстро и правильно”)

### MVP‑идея
Для каждой подстроки (`estimate_positions.id`) хранить явную привязку к:
- `project_materials.id` (обязательно)
- `material_batches.id` (опционально, можно не делать в MVP)

Далее статус подстроки вычисляется по `document_bindings` (и связанной записи `documents`).

### 1) DB: новая таблица привязки подстрок к материалам проекта

Добавить таблицу (примерное название):
- `estimate_position_material_links`

Рекомендуемые поля:
- `id` (bigint identity)
- `object_id` (int, FK → `objects.id`, NOT NULL)  
  MVP: используем “текущий объект” (`GET /api/object/current`).
- `estimate_id` (int, FK → `estimates.id`, NOT NULL)
- `estimate_position_id` (int, FK → `estimate_positions.id`, NOT NULL) — это именно подстрока
- `project_material_id` (bigint, FK → `project_materials.id`, NOT NULL)
- `batch_id` (bigint, FK → `material_batches.id`, NULL) — можно оставить на будущее
- `created_at` / `updated_at` (timestamptz)
- `source` (text, default `'manual'`) — на будущее: `manual|suggested|import`

Ограничения:
- `UNIQUE(object_id, estimate_position_id)` — одна подстрока = одна привязка в контексте объекта
- Индексы на `(object_id, estimate_id)`, `(estimate_position_id)`, `(project_material_id)`

Миграция:
- SQL‑файл в `migrations/` по принятому процессу (см. `docs/db-migrations.md`).

### 2) Backend: storage-методы

Добавить методы в `server/storage.ts`:
- `listEstimatePositionMaterialLinks(objectId, estimateId)` → список/мапа по `estimatePositionId`
- `upsertEstimatePositionMaterialLink(payload)` → создать/обновить привязку
- `deleteEstimatePositionMaterialLink(id | (objectId, estimatePositionId))` → удалить привязку (по UX)

### 3) Backend: вычисление статуса “нет / частично / ок”

Ввести единый “движок” расчёта статуса:

Вход:
- `objectId`
- `estimateId`
- список `estimatePositionIds` (только подстроки, которые отображаются)

Выход:
- для каждого `estimatePositionId`:  
  - `status: 'none' | 'partial' | 'ok'`
  - `reason?: string` (для tooltip)
  - `linkedProjectMaterialId?: number`
  - `linkedBatchId?: number`
  - `counts: { qualityDocsTotal, qualityDocsUseInActs, qualityDocsValid }` (для отладки/PRO)

Логика MVP (предлагаемая):
- Если нет привязки `estimate_position → project_material`:  
  `status = none`, reason = “Не привязан материал”
- Иначе ищем документы качества:
  - Берём `document_bindings`, где:
    - `projectMaterialId = linkedProjectMaterialId`
    - `bindingRole = 'quality'`
    - (если `batchId` задан) предпочтительно фильтровать по `batchId` (на MVP можно игнорировать)
  - JOIN к `documents`, чтобы проверить:
    - документ не удалён (`documents.deletedAt IS NULL`)
    - срок действия: `validTo IS NULL OR validTo >= today`
  - Правила статуса:
    - `ok`: есть хотя бы один документ качества **валидный** и с `useInActs=true`
    - `partial`: документы есть, но:
      - все `useInActs=false`, или
      - все просрочены, или
      - нет ни одного валидного
    - `none`: вообще нет документов качества на привязанном материале

Важно: сделать расчёт **батчево** (одним/двумя SQL), чтобы не было N+1.

### 4) API: эндпоинты под график

Добавить API (контракт в `shared/routes.ts`, реализация в `server/routes.ts`):

#### 4.1. Получение статусов подстрок для графика
`GET /api/schedules/:id/estimate-subrows/statuses`

Параметры:
- `estimateId` (number) — активная смета графика
- (опционально) `mainPositionId` или `taskId` — если хотим статусы только для раскрытой строки  
  MVP проще: отдавать статусы для всех подстрок сметы **одним запросом** и кэшировать на фронте.

Ответ:
- `{ byEstimatePositionId: Record<number, { status, reason?, projectMaterialId?, batchId? }> }`

#### 4.2. Управление привязкой (CRUD)
`POST /api/estimate-position-links`
- body: `{ objectId, estimateId, estimatePositionId, projectMaterialId, batchId? }`
- поведение: upsert

`DELETE /api/estimate-position-links/:id`
- удалить привязку

Примечание (MVP):
- `objectId` можно не передавать с клиента, а брать `current object` на сервере, чтобы не “таскать” лишнее.

### 5) Frontend: UI в `/schedule`

Цель MVP UI: **показывать статус** и дать пользователю быстрый способ **привязать подстроку к материалу проекта**.

#### 5.1. Данные
Добавить react-query хук:
- `useEstimateSubrowStatuses(scheduleId, estimateId)`

Кэш:
- ключ: `[scheduleId, estimateId, 'estimateSubrowStatuses']`

#### 5.2. Отрисовка статуса
В блоке рендера подстроки (aux row) добавить справа:
- `Badge`/иконку:
  - `none` → красный (“нет”)
  - `partial` → жёлтый (“частично”)
  - `ok` → зелёный (“ок”)
- tooltip с `reason` (если есть)

#### 5.3. Действия по подстроке (MVP)
Клик по зоне статуса открывает модалку:
- Заголовок: строка сметы (lineNo/code/name)
- Поле выбора `project material`:
  - список из `/api/objects/:objectId/materials`
  - поиск по названию
- Кнопки:
  - “Сохранить привязку”
  - “Убрать привязку”

UX‑минимум:
- Если подстрока не привязана → показывать CTA “Привязать”
- Если привязана → показывать выбранный материал (коротко) + возможность заменить

### 6) Критерии готовности MVP (Definition of Done)

- В графике `/schedule` на каждой подстроке сметы отображается один из статусов: `none|partial|ok`.
- Статус:
  - меняется при добавлении/удалении привязки подстроки к материалу
  - меняется при добавлении/изменении `document_bindings` (как минимум после refetch)
- Пользователь может:
  - привязать подстроку к материалу проекта
  - снять/заменить привязку
- Производительность:
  - статусы грузятся батчево (не N+1 на подстроки)
- Документация:
  - описана структура привязок и правила статуса

---

## PRO: план расширения (после MVP)

### PRO‑цель
Сделать “контроль ИД” системным: не только “есть/нет”, а **что именно требуется**, с учётом партий, валидности, шаблонов требований и автосопоставления.

Ниже — план по блокам, без детализации каждого SQL.

### A) Требования к документам по подстроке

Добавить таблицу требований, например:
- `estimate_position_doc_requirements`

Идея:
- для `estimate_position_id` хранить список требований:
  - `bindingRole` (quality/passport/protocol/…)
  - `minCount` (сколько документов нужно)
  - `requirePrimary` (нужен ли `isPrimary=true`)
  - `requireFile` (нужен ли `fileUrl`)
  - `validityPolicy` (учитывать ли `validTo`, допускать ли просрочку)

Тогда статус становится “по правилам”, а не “по одному quality документу”.

### B) Партии (batch) как уровень точности

Поддержать привязку подстроки к `batch_id`:
- статус по умолчанию считается по `batch_id`, а при отсутствии — по `project_material_id`
- UI: выбор партии внутри выбранного материала

Опционально:
- “использованная партия” может жить в связке с актом (например, при формировании актов/п.3), но для контроля на графике достаточно batch‑привязки на подстроке.

### C) Автосопоставление (ускорение внедрения)

Два слоя:

1) **Глобальный словарь** “код/имя строки сметы → materials_catalog”
   - хранить `confidence` и `source`
   - давать пользователю предложенный вариант (1‑клик подтвердить)

2) **Объектный слой** “materials_catalog → project_material”
   - если на объекте уже есть такой `catalogMaterialId`, автоподставлять
   - иначе предлагать создать `project_material`

Важно:
- автосопоставление никогда не должно молча “привязывать” — только предлагать.

### D) Статусы на уровне работы/акта

Сверху над подстроками можно считать агрегаты:
- статус основной строки (task) = агрегат по её подстрокам:
  - `ok` если все `ok`
  - `partial` если есть смесь
  - `none` если все `none` или нет привязок
- статус акта (actNumber) = агрегат по задачам, входящим в акт

Это даст “светофор” по актам и работам.

### E) Производительность и UX на больших сметах

- Кэширование статусов по `estimateId` на клиенте
- Серверные агрегаты/материализованные представления (если понадобится)
- Виртуализация списка подстрок в UI (если их тысячи)

---

## Риски и решения

- **Неполные данные в смете**: у подстрок может не быть кода/единиц/типов.  
  Решение: MVP опирается на ручную привязку к `project_material`.

- **Дублирование ответственности**: “статус в графике” vs “истина в документах”.  
  Решение: график хранит только ссылки, статус вычисляется из `document_bindings`.

- **Партии усложняют ввод**.  
  Решение: партии — PRO‑уровень, MVP можно оставить на уровне `project_material`.

---

## Приложение: где это лежит в текущей архитектуре

- Контракты API: `shared/routes.ts`
- Реализация API: `server/routes.ts`
- Доступ к данным: `server/storage.ts`
- UI графика: `client/src/pages/Schedule.tsx`
- Материалы/документы: `project_materials`, `material_batches`, `documents`, `document_bindings`

