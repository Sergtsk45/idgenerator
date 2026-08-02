-- D′: several quality docs per material in task/act; batch orthogonal to docs.
-- Unique task_materials by (task, material, document); acts.attachments_manual for act-card edits.

-- Preflight cleanup: keep earliest row per (task_id, project_material_id, quality_document_id)
DELETE FROM task_materials tm
USING task_materials newer
WHERE tm.quality_document_id IS NOT NULL
  AND newer.quality_document_id IS NOT NULL
  AND tm.task_id = newer.task_id
  AND tm.project_material_id = newer.project_material_id
  AND tm.quality_document_id = newer.quality_document_id
  AND tm.id > newer.id;

DROP INDEX IF EXISTS "task_materials_task_material_batch_uq";

CREATE UNIQUE INDEX IF NOT EXISTS "task_materials_task_material_doc_uq"
  ON "task_materials" ("task_id", "project_material_id", "quality_document_id");

ALTER TABLE "acts"
  ADD COLUMN IF NOT EXISTS "attachments_manual" BOOLEAN NOT NULL DEFAULT FALSE;
