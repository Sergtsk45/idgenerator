-- TASK-008: quality-document upload sessions and their consumed targets.

ALTER TABLE "upload_sessions"
  DROP CONSTRAINT IF EXISTS "upload_sessions_purpose_check";
ALTER TABLE "upload_sessions"
  ADD CONSTRAINT "upload_sessions_purpose_check"
  CHECK ("purpose" IN ('estimate', 'quality_document'));

ALTER TABLE "upload_sessions"
  ADD COLUMN IF NOT EXISTS "document_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "project_material_id" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'upload_sessions_document_id_fkey'
      AND conrelid = 'upload_sessions'::regclass
  ) THEN
    ALTER TABLE "upload_sessions"
      ADD CONSTRAINT "upload_sessions_document_id_fkey"
      FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'upload_sessions_project_material_id_fkey'
      AND conrelid = 'upload_sessions'::regclass
  ) THEN
    ALTER TABLE "upload_sessions"
      ADD CONSTRAINT "upload_sessions_project_material_id_fkey"
      FOREIGN KEY ("project_material_id") REFERENCES "project_materials"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "upload_sessions_document_id_idx"
  ON "upload_sessions" ("document_id");
CREATE INDEX IF NOT EXISTS "upload_sessions_project_material_id_idx"
  ON "upload_sessions" ("project_material_id");

-- Safe rollback: drop both indexes and foreign keys, drop document_id and
-- project_material_id, then restore upload_sessions_purpose_check to ('estimate').
