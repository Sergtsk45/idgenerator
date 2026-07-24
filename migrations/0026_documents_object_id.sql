-- Migration: 0026_documents_object_id
-- Description: Adds object_id to documents and backfills project document scope by object.
-- Created: 2026-07-24

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "object_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_object_id_fkey'
      AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE "documents"
      ADD CONSTRAINT documents_object_id_fkey
      FOREIGN KEY ("object_id")
      REFERENCES "objects"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "documents_object_id_idx"
  ON "documents" ("object_id");

CREATE INDEX IF NOT EXISTS "documents_scope_object_idx"
  ON "documents" ("scope", "object_id");

WITH binding_objects AS (
  SELECT
    db."document_id",
    db."object_id"
  FROM "document_bindings" db
  WHERE db."object_id" IS NOT NULL

  UNION

  SELECT
    db."document_id",
    pm."object_id"
  FROM "document_bindings" db
  JOIN "project_materials" pm
    ON pm."id" = db."project_material_id"
  WHERE pm."object_id" IS NOT NULL

  UNION

  SELECT
    db."document_id",
    mb."object_id"
  FROM "document_bindings" db
  JOIN "material_batches" mb
    ON mb."id" = db."batch_id"
  WHERE mb."object_id" IS NOT NULL
),
resolved_objects AS (
  SELECT
    "document_id",
    MIN("object_id") AS "object_id"
  FROM binding_objects
  GROUP BY "document_id"
  HAVING COUNT(DISTINCT "object_id") = 1
)
UPDATE "documents" d
SET "object_id" = ro."object_id"
FROM resolved_objects ro
WHERE d."id" = ro."document_id"
  AND d."scope" = 'project'
  AND d."object_id" IS NULL
  AND d."deleted_at" IS NULL;

UPDATE "documents" d
SET "deleted_at" = now()
WHERE d."scope" = 'project'
  AND d."object_id" IS NULL
  AND d."deleted_at" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_scope_object_check'
      AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE "documents"
      ADD CONSTRAINT documents_scope_object_check
      CHECK (
        "deleted_at" IS NOT NULL
        OR ("scope" = 'global' AND "object_id" IS NULL)
        OR ("scope" = 'project' AND "object_id" IS NOT NULL)
      );
  END IF;
END $$;
