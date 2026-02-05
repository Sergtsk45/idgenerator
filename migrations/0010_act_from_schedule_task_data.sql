-- @file: 0010_act_from_schedule_task_data.sql
-- @description: Acts are generated only from schedule tasks; store act type and task-scoped materials/docs
-- @created: 2026-02-05
--
-- Changes:
-- - Extend schedule_tasks with act template reference and task documentation fields
-- - Add task_materials table (materials linked to a schedule task)
-- - Extend acts with act template reference and aggregated docs from tasks
-- - Remove legacy acts not referenced by schedule_tasks

-- ----
-- 1) Extend schedule_tasks
-- ----

ALTER TABLE "schedule_tasks"
  ADD COLUMN IF NOT EXISTS "act_template_id" INTEGER REFERENCES "act_templates"("id") ON DELETE SET NULL;

ALTER TABLE "schedule_tasks"
  ADD COLUMN IF NOT EXISTS "project_drawings" TEXT,
  ADD COLUMN IF NOT EXISTS "normative_refs" TEXT,
  ADD COLUMN IF NOT EXISTS "executive_schemes" JSONB;

CREATE INDEX IF NOT EXISTS "schedule_tasks_schedule_act_template_idx"
  ON "schedule_tasks" ("schedule_id", "act_template_id")
  WHERE "act_template_id" IS NOT NULL;

-- ----
-- 2) Create task_materials
-- ----

CREATE TABLE IF NOT EXISTS "task_materials" (
  "id" SERIAL PRIMARY KEY,
  "task_id" INTEGER NOT NULL REFERENCES "schedule_tasks"("id") ON DELETE CASCADE,
  "project_material_id" BIGINT NOT NULL REFERENCES "project_materials"("id") ON DELETE RESTRICT,
  "batch_id" BIGINT REFERENCES "material_batches"("id") ON DELETE SET NULL,
  "quality_document_id" BIGINT REFERENCES "documents"("id") ON DELETE RESTRICT,
  "note" TEXT,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "task_materials_task_id_idx"
  ON "task_materials" ("task_id");

CREATE INDEX IF NOT EXISTS "task_materials_order_idx"
  ON "task_materials" ("task_id", "order_index");

CREATE UNIQUE INDEX IF NOT EXISTS "task_materials_task_material_batch_uq"
  ON "task_materials" ("task_id", "project_material_id", "batch_id");

-- ----
-- 3) Extend acts
-- ----

ALTER TABLE "acts"
  ADD COLUMN IF NOT EXISTS "act_template_id" INTEGER REFERENCES "act_templates"("id") ON DELETE SET NULL;

ALTER TABLE "acts"
  ADD COLUMN IF NOT EXISTS "project_drawings_agg" TEXT,
  ADD COLUMN IF NOT EXISTS "normative_refs_agg" TEXT,
  ADD COLUMN IF NOT EXISTS "executive_schemes_agg" JSONB;

CREATE INDEX IF NOT EXISTS "acts_act_template_id_idx"
  ON "acts" ("act_template_id")
  WHERE "act_template_id" IS NOT NULL;

-- Backfill act_template_id from existing selections (if any)
UPDATE "acts" a
SET "act_template_id" = s.template_id
FROM (
  SELECT "act_id", MIN("template_id") AS template_id
  FROM "act_template_selections"
  WHERE "template_id" IS NOT NULL
  GROUP BY "act_id"
) s
WHERE a."id" = s."act_id"
  AND a."act_template_id" IS NULL;

-- ----
-- 4) Remove legacy acts not referenced by schedule_tasks
-- ----

DELETE FROM "acts"
WHERE
  "act_number" IS NULL
  OR "act_number" NOT IN (
    SELECT DISTINCT "act_number"
    FROM "schedule_tasks"
    WHERE "act_number" IS NOT NULL
  );

