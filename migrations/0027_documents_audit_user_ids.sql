-- Migration: 0027_documents_audit_user_ids
-- Description: Adds optional audit user references to documents.
-- Created: 2026-07-24

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "created_by_user_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "updated_by_user_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_created_by_user_id_fkey'
      AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE "documents"
      ADD CONSTRAINT documents_created_by_user_id_fkey
      FOREIGN KEY ("created_by_user_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_updated_by_user_id_fkey'
      AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE "documents"
      ADD CONSTRAINT documents_updated_by_user_id_fkey
      FOREIGN KEY ("updated_by_user_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "documents_created_by_user_id_idx"
  ON "documents" ("created_by_user_id");

CREATE INDEX IF NOT EXISTS "documents_updated_by_user_id_idx"
  ON "documents" ("updated_by_user_id");

UPDATE "documents" d
SET "created_by_user_id" = o."user_id"
FROM "objects" o
WHERE d."scope" = 'project'
  AND d."object_id" = o."id"
  AND d."created_by_user_id" IS NULL
  AND o."user_id" IS NOT NULL;

UPDATE "documents"
SET "updated_by_user_id" = "created_by_user_id"
WHERE "updated_by_user_id" IS NULL
  AND "created_by_user_id" IS NOT NULL;
