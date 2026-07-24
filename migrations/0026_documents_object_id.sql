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
binding_object_stats AS (
  SELECT
    "document_id",
    COUNT(DISTINCT "object_id") AS "object_count"
  FROM binding_objects
  GROUP BY "document_id"
),
unresolved_project_documents AS (
  SELECT
    d."id",
    CASE
      WHEN COALESCE(bos."object_count", 0) = 0 THEN 'no_binding_object'
      ELSE 'conflicting_binding_objects'
    END AS "reason",
    COALESCE(bos."object_count", 0) AS "object_count"
  FROM "documents" d
  LEFT JOIN binding_object_stats bos
    ON bos."document_id" = d."id"
  WHERE d."scope" = 'project'
    AND d."object_id" IS NULL
    AND d."deleted_at" IS NULL
)
UPDATE "documents" d
SET
  "deleted_at" = now(),
  "meta" = jsonb_set(
    COALESCE(d."meta", '{}'::jsonb),
    '{scopeMigration0026}',
    jsonb_build_object(
      'action', 'soft_deleted_before_scope_check',
      'reason', upd."reason",
      'bindingObjectCount', upd."object_count",
      'at', now()
    ),
    true
  )
FROM unresolved_project_documents upd
WHERE d."id" = upd."id";

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
