-- TASK-009: workflow-scoped acts and owner-scoped generated artifacts.

ALTER TABLE "acts"
  ADD COLUMN IF NOT EXISTS "workflow_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "schedule_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acts_workflow_id_fkey') THEN
    ALTER TABLE "acts" ADD CONSTRAINT "acts_workflow_id_fkey"
      FOREIGN KEY ("workflow_id") REFERENCES "execution_workflows"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acts_schedule_id_fkey') THEN
    ALTER TABLE "acts" ADD CONSTRAINT "acts_schedule_id_fkey"
      FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE "acts" DROP CONSTRAINT IF EXISTS "acts_act_number_unique";
DROP INDEX IF EXISTS "acts_act_number_unique";

CREATE INDEX IF NOT EXISTS "acts_workflow_id_idx" ON "acts" ("workflow_id");
CREATE INDEX IF NOT EXISTS "acts_schedule_id_idx" ON "acts" ("schedule_id");
CREATE UNIQUE INDEX IF NOT EXISTS "acts_workflow_act_number_uq"
  ON "acts" ("workflow_id", "act_number")
  WHERE "workflow_id" IS NOT NULL AND "act_number" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "acts_legacy_object_act_number_uq"
  ON "acts" ("object_id", "act_number")
  WHERE "workflow_id" IS NULL AND "object_id" IS NOT NULL AND "act_number" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "act_artifacts" (
  "id" TEXT PRIMARY KEY,
  "workflow_id" INTEGER NOT NULL REFERENCES "execution_workflows"("id") ON DELETE CASCADE,
  "act_id" INTEGER NOT NULL REFERENCES "acts"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "object_id" INTEGER NOT NULL REFERENCES "objects"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL UNIQUE,
  "filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL DEFAULT 'application/pdf',
  "size_bytes" BIGINT NOT NULL,
  "sha256" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "act_artifacts_kind_check" CHECK ("kind" IN ('act_pdf', 'attachments_pdf')),
  CONSTRAINT "act_artifacts_mode_check" CHECK ("mode" IN ('draft', 'final'))
);

CREATE INDEX IF NOT EXISTS "act_artifacts_workflow_id_idx" ON "act_artifacts" ("workflow_id");
CREATE INDEX IF NOT EXISTS "act_artifacts_act_id_idx" ON "act_artifacts" ("act_id");
CREATE INDEX IF NOT EXISTS "act_artifacts_user_object_idx" ON "act_artifacts" ("user_id", "object_id");

-- Safe rollback requires dropping act_artifacts, the two scoped unique indexes,
-- workflow/schedule FKs and columns, then restoring global act_number uniqueness
-- only after checking for duplicates introduced by workflow-scoped numbering.
