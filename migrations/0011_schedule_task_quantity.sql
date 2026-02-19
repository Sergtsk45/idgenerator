-- @file: 0011_schedule_task_quantity.sql
-- @description: Add independent quantity/unit fields to schedule_tasks.
--   Volumes are copied from the source (works / estimate_positions) during bootstrap
--   and become independent values that can be edited per-task.
-- @created: 2026-02-18

-- ----
-- 1) Extend schedule_tasks with quantity and unit
-- ----

ALTER TABLE "schedule_tasks"
  ADD COLUMN IF NOT EXISTS "quantity" NUMERIC(20, 4),
  ADD COLUMN IF NOT EXISTS "unit" TEXT;

-- ----
-- 2) Backfill existing tasks from the works (BoQ) source
-- ----

UPDATE "schedule_tasks" st
SET
  "quantity" = w."quantity_total",
  "unit"     = w."unit"
FROM "works" w
WHERE st."work_id" = w."id"
  AND st."quantity" IS NULL;

-- ----
-- 3) Backfill existing tasks from the estimate_positions source
-- ----

UPDATE "schedule_tasks" st
SET
  "quantity" = ep."quantity",
  "unit"     = ep."unit"
FROM "estimate_positions" ep
WHERE st."estimate_position_id" = ep."id"
  AND st."quantity" IS NULL;
