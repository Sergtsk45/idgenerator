-- @file: 0005_materials_documents.sql
-- @description: Materials + documents quality module (catalog, project materials, batches, documents, bindings, act usages, act document attachments)
-- @created: 2026-02-01
--
-- NOTE: Единственный способ изменения БД — SQL-миграции (этот файл).
-- drizzle-kit используется только для генерации миграций (`drizzle-kit generate`).
-- `drizzle-kit push` в проекте не применяется.

-- ----
-- updated_at trigger helper
-- ----

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----
-- 1) materials_catalog — global catalog
-- ----

CREATE TABLE IF NOT EXISTS "materials_catalog" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "standard_ref" TEXT,
  "base_unit" TEXT,
  "params" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);

ALTER TABLE "materials_catalog"
  ADD CONSTRAINT materials_catalog_category_check
  CHECK (category IN ('material', 'equipment', 'product') OR category IS NULL);

CREATE INDEX IF NOT EXISTS "materials_catalog_name_idx"
  ON "materials_catalog" ("name");

CREATE UNIQUE INDEX IF NOT EXISTS "materials_catalog_name_uniq"
  ON "materials_catalog" ("name")
  WHERE "deleted_at" IS NULL;

DROP TRIGGER IF EXISTS materials_catalog_updated_at ON "materials_catalog";
CREATE TRIGGER materials_catalog_updated_at
  BEFORE UPDATE ON "materials_catalog"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----
-- 2) project_materials — material within an object (project-scoped)
-- ----

CREATE TABLE IF NOT EXISTS "project_materials" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "object_id" INTEGER NOT NULL REFERENCES "objects"("id") ON DELETE RESTRICT,
  "catalog_material_id" BIGINT REFERENCES "materials_catalog"("id") ON DELETE SET NULL,
  "name_override" TEXT,
  "base_unit_override" TEXT,
  "params_override" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "project_materials_object_id_idx"
  ON "project_materials" ("object_id");

CREATE INDEX IF NOT EXISTS "project_materials_catalog_id_idx"
  ON "project_materials" ("catalog_material_id");

DROP TRIGGER IF EXISTS project_materials_updated_at ON "project_materials";
CREATE TRIGGER project_materials_updated_at
  BEFORE UPDATE ON "project_materials"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----
-- 3) material_batches — deliveries / batches for a material within an object
-- ----

CREATE TABLE IF NOT EXISTS "material_batches" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "object_id" INTEGER NOT NULL REFERENCES "objects"("id") ON DELETE RESTRICT,
  "project_material_id" BIGINT NOT NULL REFERENCES "project_materials"("id") ON DELETE CASCADE,
  "supplier_name" TEXT,
  "manufacturer" TEXT,
  "plant" TEXT,
  "batch_number" TEXT,
  "delivery_date" DATE,
  "quantity" NUMERIC(14, 3),
  "unit" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "material_batches"
  ADD CONSTRAINT material_batches_quantity_check
  CHECK ("quantity" IS NULL OR "quantity" >= 0);

CREATE INDEX IF NOT EXISTS "material_batches_project_material_id_idx"
  ON "material_batches" ("project_material_id");

DROP TRIGGER IF EXISTS material_batches_updated_at ON "material_batches";
CREATE TRIGGER material_batches_updated_at
  BEFORE UPDATE ON "material_batches"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----
-- 4) documents — documents registry
-- ----

CREATE TABLE IF NOT EXISTS "documents" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "doc_type" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'project',
  "title" TEXT,
  "doc_number" TEXT,
  "doc_date" DATE,
  "issuer" TEXT,
  "valid_from" DATE,
  "valid_to" DATE,
  "meta" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "file_url" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);

ALTER TABLE "documents"
  ADD CONSTRAINT documents_doc_type_check
  CHECK (doc_type IN ('certificate', 'declaration', 'passport', 'protocol', 'scheme', 'other'));

ALTER TABLE "documents"
  ADD CONSTRAINT documents_scope_check
  CHECK (scope IN ('global', 'project'));

ALTER TABLE "documents"
  ADD CONSTRAINT documents_valid_dates_check
  CHECK ("valid_from" IS NULL OR "valid_to" IS NULL OR "valid_from" <= "valid_to");

CREATE INDEX IF NOT EXISTS "documents_doc_type_idx"
  ON "documents" ("doc_type");

CREATE INDEX IF NOT EXISTS "documents_scope_idx"
  ON "documents" ("scope");

CREATE INDEX IF NOT EXISTS "documents_doc_number_idx"
  ON "documents" ("doc_number");

DROP TRIGGER IF EXISTS documents_updated_at ON "documents";
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON "documents"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----
-- 5) document_bindings — links between documents and targets (object/material/batch)
-- ----

CREATE TABLE IF NOT EXISTS "document_bindings" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "document_id" BIGINT NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "object_id" INTEGER REFERENCES "objects"("id") ON DELETE CASCADE,
  "project_material_id" BIGINT REFERENCES "project_materials"("id") ON DELETE CASCADE,
  "batch_id" BIGINT REFERENCES "material_batches"("id") ON DELETE CASCADE,
  "binding_role" TEXT NOT NULL DEFAULT 'quality',
  "use_in_acts" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "document_bindings"
  ADD CONSTRAINT document_bindings_role_check
  CHECK (binding_role IN ('quality', 'passport', 'protocol', 'scheme', 'other'));

ALTER TABLE "document_bindings"
  ADD CONSTRAINT document_bindings_has_target_check
  CHECK ("object_id" IS NOT NULL OR "project_material_id" IS NOT NULL OR "batch_id" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "document_bindings_document_id_idx"
  ON "document_bindings" ("document_id");

CREATE INDEX IF NOT EXISTS "document_bindings_project_material_id_idx"
  ON "document_bindings" ("project_material_id");

CREATE INDEX IF NOT EXISTS "document_bindings_object_id_idx"
  ON "document_bindings" ("object_id");

-- ----
-- 6) act_material_usages — selected materials for AOSR p.3
-- ----

CREATE TABLE IF NOT EXISTS "act_material_usages" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "act_id" INTEGER NOT NULL REFERENCES "acts"("id") ON DELETE CASCADE,
  "project_material_id" BIGINT NOT NULL REFERENCES "project_materials"("id") ON DELETE RESTRICT,
  "work_id" INTEGER REFERENCES "works"("id") ON DELETE SET NULL,
  "batch_id" BIGINT REFERENCES "material_batches"("id") ON DELETE SET NULL,
  "quality_document_id" BIGINT REFERENCES "documents"("id") ON DELETE RESTRICT,
  "note" TEXT,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "act_material_usages_act_id_idx"
  ON "act_material_usages" ("act_id");

CREATE INDEX IF NOT EXISTS "act_material_usages_order_idx"
  ON "act_material_usages" ("act_id", "order_index");

-- ----
-- 7) act_document_attachments — formal AOSR attachments (unique per act)
-- ----

CREATE TABLE IF NOT EXISTS "act_document_attachments" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "act_id" INTEGER NOT NULL REFERENCES "acts"("id") ON DELETE CASCADE,
  "document_id" BIGINT NOT NULL REFERENCES "documents"("id") ON DELETE RESTRICT,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "act_document_attachments_act_doc_uniq"
  ON "act_document_attachments" ("act_id", "document_id");

CREATE INDEX IF NOT EXISTS "act_document_attachments_act_id_idx"
  ON "act_document_attachments" ("act_id");

CREATE INDEX IF NOT EXISTS "act_document_attachments_order_idx"
  ON "act_document_attachments" ("act_id", "order_index");

