# План: создание материала из задачи графика

**Дата**: 2026-08-02  
**Статус**: реализовано

## Цель

Убрать разрыв UX: создание отсутствующего материала прямо из `/select-task-materials` с автопривязкой к задаче.

## Решение

1. Переиспользовать `MaterialWizard` как диалог поверх страницы задачи.
2. Новые optional props: `onCreated`, `initialSource`, `skipSourceStep`.
3. Результат: `{ projectMaterialId, batchId, qualityDocumentId, displayName }`.
4. Привязка через существующий `PUT taskMaterials.replace` (split-sync сохраняется).
5. Persist передаёт актуальный локальный массив, чтобы не терять несохранённые правки.
6. Результат create-пайплайна кэшируется в мастере до `onCreated`: при ошибке привязки повторяется только persist, без нового материала/партии/документа.
7. Локальный `submitting` с синхронным ref-guard блокирует «Готово» на всём пайплайне; append результата идемпотентен по `projectMaterialId`.

## Ограничения

- Ошибка `onCreated` больше не требует закрывать мастер: безопасный retry реализован.
- Ownership для остальных patch/delete/save-to-catalog/bulk materials endpoints вынесен в backlog `docs/tasktracker.md`.

## Файлы

- `client/src/components/materials/MaterialWizard.tsx`
- `client/src/components/materials/materialWizardResult.ts`
- `client/src/pages/SelectTaskMaterials.tsx`
- `client/src/pages/selectTaskMaterialsHelpers.ts`
- `server/routes/schedule.ts`, `server/routes/materials.ts`
- `tests/create-material-from-task.test.ts`
