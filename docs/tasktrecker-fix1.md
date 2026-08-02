# Task Tracker: фиксы после review PR #2 (create material from task)

> **Фича**: `create-material-from-task-fixes`
> **PR**: https://github.com/Sergtsk45/idgenerator/pull/2  
> **Ветка**: `cursor/create-material-from-task-1f4a`  
> **Дата фиксации**: 2026-08-02  
> **Статус**: FIX-A/B завершены; FIX-C зафиксирована в backlog  
> **Зависимость**: PR #2 — создание материала из задачи с автопривязкой (базовая реализация есть)

---

## Цель

Устранить дефекты, найденные при review PR #2, до merge (или сразу после merge в follow-up PR):

1. Не допускать создания дубликата материала при повторном «Готово» после ошибки привязки к задаче.
2. Держать кнопку «Готово» заблокированной на всём пайплайне submit (create → batch → doc → onCreated).
3. Зафиксировать follow-up по ownership на остальных materials-эндпоинтах (вне минимального scope, но не потерять).

---

## Контекст (as-is)

### Поток сейчас

```
MaterialWizard.submit()
  → createProjectMaterial          // материал уже в объекте
  → optional createBatch
  → optional createDocument + binding
  → await onCreated(result)        // SelectTaskMaterials: append + replaceTaskMaterials
  → close() только при успехе onCreated
```

При ошибке `onCreated`:

- toast: «Материал создан, но не удалось добавить его в задачу…»
- `return` **без** `close()` — мастер остаётся открытым;
- локальный список задачи уже содержит новую строку (`setMaterials` до persist);
- `isBusy` снова `false` → пользователь может нажать «Готово» ещё раз → **второй** `createProjectMaterial`.

### Почему `isBusy` не спасает

```ts
const isBusy =
  createMaterial.isPending ||
  createDocument.isPending ||
  createBinding.isPending;
```

Не покрывает:

- raw `fetch` создания партии;
- `await props.onCreated(result)` (replaceTaskMaterials).

На этих этапах кнопка «Готово» разблокирована → риск двойного клика даже при первом успешном проходе.

### Связанные файлы

| Файл | Роль |
|------|------|
| `client/src/components/materials/MaterialWizard.tsx` | submit / close / isBusy / onCreated |
| `client/src/pages/SelectTaskMaterials.tsx` | `handleMaterialCreated`, materialsRef, persist |
| `client/src/pages/selectTaskMaterialsHelpers.ts` | append / toReplace |
| `client/src/components/materials/materialWizardResult.ts` | CreatedMaterialResult |
| `tests/create-material-from-task.test.ts` | runnable checks |
| `server/routes/materials.ts`, `server/routes/schedule.ts` | auth (уже усилены в PR; gap — follow-up) |

---

## Принятые решения

### FIX-1 — Идемпотентность после успешного create (блокер)

**Выбранный вариант: A (предпочтительный)**

После успешного `createProjectMaterial` сохранить в состоянии мастера `createdResult` / `projectMaterialId`.

- Если create уже выполнен, повторный «Готово» **не** вызывает create/batch/doc заново.
- Повтор только: `await onCreated(createdResult)` (retry bind).
- При успехе — toast + `close()` + reset (включая очистку `createdResult`).
- При ошибке bind — мастер может остаться открытым, но retry безопасен.

**Вариант B (проще, но хуже UX):** при ошибке onCreated сразу `close()`; строка уже в локальном списке с `hasUnsavedChanges` — пользователь жмёт «Сохранить» на странице. Минус: мастер закрывается, менее очевидно, что можно повторить bind.

**Вариант C:** только `submitting`-флаг без идемпотентности — защищает от double-click, но **не** от сознательного второго «Готово» после ошибки. Недостаточно как единственный фикс.

→ **Делаем A + FIX-2 (submitting).** Вариант B — запасной, если A раздувает diff.

### FIX-2 — Флаг `submitting` на весь submit

Локальный `const [submitting, setSubmitting] = useState(false)` (или ref+state):

- `true` в начале `submit`, `false` в `finally`;
- кнопка: `disabled={isBusy || submitting}`;
- спиннер при `submitting || isBusy`.

Покрывает batch fetch и onCreated.

### FIX-3 — Согласованность локального списка при ошибке bind

Сейчас `handleMaterialCreated`:

1. `appendCreatedMaterial` → `setMaterials`
2. `persistMaterials`
3. при ошибке — throw (строка остаётся локально)

Это **оставить**: материал в объекте уже есть, строка в UI нужна для ручного save.

Дополнительно (желательно):

- не вызывать `appendCreatedMaterial` повторно, если `projectMaterialId` уже есть в `materialsRef` (защита от двойного append при retry A);
- либо append делать **один раз** в мастере/странице при первом create, а retry только `persistMaterials`.

Рекомендуемый контракт:

```ts
// SelectTaskMaterials.handleMaterialCreated
const already = materialsRef.current.some(
  (m) => m.projectMaterialId === result.projectMaterialId,
);
const next = already
  ? materialsRef.current
  : appendCreatedMaterial(materialsRef.current, result);
// затем persist(next)
```

### FIX-4 — Тесты на регрессию

Добавить в `tests/create-material-from-task.test.ts` (и/или вынести чистую логику retry в хелпер):

| Кейс | Ожидание |
|------|----------|
| После create + fail onCreated | повтор не создаёт новый material id |
| Dedup append | второй append того же `projectMaterialId` не удлиняет список |
| `isBusy`/submitting | в исходнике есть `submitting` (или эквивалент) и им disabled на «Готово» |
| Контракт | при ошибке onCreated нет немедленного `close()` **или** (если выбран B) есть close + комментарий/тест под B |

Чистую логику «resolve submit action: create vs retry bind» лучше вынести в маленький хелпер (например `materialWizardSubmitGate.ts`), чтобы тестировать без React.

### FIX-5 — Follow-up ownership (не блокер merge)

Отдельная задача / issue (не обязательно в этом же PR):

- `projectMaterials.patch`, `saveToCatalog`
- `materialBatches.patch` / `delete`
- прочие materials endpoints без `requireObjectAccess` / ownership

В этом файле — только трекинг; реализация вне минимального fix-пакета.

---

## Целевое поведение (to-be)

### Happy path

1. Пользователь создаёт материал в мастере → «Готово».
2. Кнопка disabled на всём пайплайне.
3. Материал в объекте → строка в задаче → replace OK → toast «создан и добавлен» → мастер закрыт, форма сброшена.

### Bind fail

1. Материал уже в объекте; строка уже (или однократно) в локальном списке.
2. Toast об ошибке привязки; мастер **остаётся открытым** (вариант A).
3. Повтор «Готово» → **только** retry `onCreated` / persist, **без** нового create.
4. Успех → close. Или пользователь закрывает мастер и жмёт «Сохранить» на странице.

### Double-click

На всём submit кнопка disabled → второй клик не стартует параллельный submit.

---

## Шаги выполнения

### Задача: FIX-A — submitting + идемпотентный retry

- **Статус**: Завершена
- **Описание**: Защита MaterialWizard от дублей create и двойного клика.
- **Шаги**:
  - [x] Добавить `submitting` (state) вокруг всего `submit` + `finally`
  - [x] `disabled={isBusy \|\| submitting}` на «Готово»; спиннер при submitting
  - [x] После успешного create сохранить `createdResult` в state/ref мастера
  - [x] В начале submit: если `createdResult` уже есть → skip create/batch/doc, только `onCreated(createdResult)`
  - [x] На успешном close/`reset` очищать `createdResult`
  - [x] В `handleMaterialCreated` — dedup по `projectMaterialId` перед append
  - [x] Тесты: gate/retry + dedup append + контракт disabled/submitting
  - [x] Smoke: `npm run check`, `npm test`, `npm run build`
- **Файлы**: `MaterialWizard.tsx`, опционально новый хелпер, `SelectTaskMaterials.tsx`, `selectTaskMaterialsHelpers.ts`, `tests/create-material-from-task.test.ts`
- **Зависимости**: —

### Задача: FIX-B — документация

- **Статус**: Завершена
- **Шаги**:
  - [x] `docs/changelog.md` — запись об исправлении дубля / submitting
  - [x] `docs/tasktracker.md` — статус этой задачи
  - [x] Обновить план `ai_docs/develop/plans/2026-08-02-create-material-from-task.md` (ограничение про retry — снято)
- **Зависимости**: FIX-A

### Задача: FIX-C — follow-up ownership (backlog)

- **Статус**: Зафиксирована в backlog (реализация вне scope merge-блокера)
- **Описание**: Дожать auth/ownership на оставшихся materials routes.
- **Шаги**:
  - [x] Инвентаризация endpoints в `server/routes/materials.ts` без ownership
  - [ ] Добавить appAuth + object/material ownership по аналогии с create/get/batch.create
  - [ ] Тесты/контракт на 401/403
- **Зависимости**: merge PR #2 желателен, но не обязателен

---

## Acceptance criteria

- [x] Повторное нажатие «Готово» после ошибки привязки **не** создаёт второй `project_materials` row.
- [x] Во время create/batch/doc/onCreated кнопка «Готово» disabled, виден индикатор загрузки.
- [x] Успешный путь без регрессии: материал в объекте + в задаче через `replaceTaskMaterials`.
- [x] scheme/other по-прежнему → `qualityDocumentId: null`.
- [x] Вызовы MaterialWizard без `onCreated` (SourceMaterials и т.п.) без регрессии.
- [x] `npm run check` / `npm test` / `npm run build` — зелёные.
- [x] Changelog + tasktracker обновлены.

---

## Ручной smoke (после фикса)

| # | Сценарий | Ожидание |
|---|----------|----------|
| M1 | Создать материал без партии/дока → OK | Одна строка в задаче, мастер закрыт |
| M2 | С партией + passport → OK | batch + qualityDocumentId заполнены |
| M3 | scheme/other | qualityDocumentId = null, binding на материале есть |
| M4 | Симулировать fail replace (сеть/403) → «Готово» ещё раз | Второй material **не** создаётся; после успеха сеть — одна строка |
| M5 | Double-click «Готово» | Один create |
| M6 | Split-задача, `independentMaterials=false` | Материалы сиблингов синхронизируются через replace |
| M7 | Открыть мастер из SourceMaterials (без onCreated) | Старое поведение «Материал добавлен» |

---

## Вне скоупа этого фикса

- Полный e2e в Telegram WebView (желателен, но не блокер при покрытии unit + ручной M4–M5).
- Ownership patch/delete batch (FIX-C).
- Multi-select нескольких docs при создании из мастера (уже покрыто отдельным D′ UX на странице задачи).
- Дедуп по имени материала в объекте (другая фича).

---

## Оценка

| Пакет | Оценка |
|-------|--------|
| FIX-A + тесты | 1–2 часа |
| FIX-B docs | 15 минут |
| FIX-C backlog | отдельно, 2–4 часа |

---

## История

| Дата | Событие |
|------|---------|
| 2026-08-02 | Review PR #2: зафиксированы дубль при retry, узкий isBusy, ownership gap |
| 2026-08-02 | Создан этот трекер `docs/tasktrecker-fix1.md` |
| 2026-08-02 | FIX-A/B реализованы и проверены; FIX-C внесена отдельным backlog в `docs/tasktracker.md` |
