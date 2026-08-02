-- TASK-007: material register state, classifications, traceable estimate sources,
-- applied document requirements, and generated schedule-task material links.

ALTER TABLE "task_materials"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE "task_materials"
  DROP CONSTRAINT IF EXISTS "task_materials_source_check";
ALTER TABLE "task_materials"
  ADD CONSTRAINT "task_materials_source_check"
  CHECK ("source" IN ('manual', 'material_register'));

CREATE UNIQUE INDEX IF NOT EXISTS "task_materials_generated_material_uq"
  ON "task_materials" ("task_id", "project_material_id")
  WHERE "source" = 'material_register' AND "quality_document_id" IS NULL;

CREATE TABLE IF NOT EXISTS "material_register_states" (
  "workflow_id" INTEGER PRIMARY KEY REFERENCES "execution_workflows"("id") ON DELETE CASCADE,
  "estimate_id" INTEGER NOT NULL REFERENCES "estimates"("id") ON DELETE CASCADE,
  "input_hash" TEXT NOT NULL,
  "rules_version" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "material_register_items" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "workflow_id" INTEGER NOT NULL REFERENCES "execution_workflows"("id") ON DELETE CASCADE,
  "project_material_id" BIGINT NOT NULL REFERENCES "project_materials"("id") ON DELETE CASCADE,
  "fingerprint" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "normalized_unit" TEXT,
  "classification" TEXT NOT NULL,
  "classification_method" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "confirmed" BOOLEAN NOT NULL DEFAULT FALSE,
  "classification_rule_id" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "material_register_items_classification_check"
    CHECK ("classification" IN ('material', 'equipment', 'product', 'unclassified')),
  CONSTRAINT "material_register_items_method_check"
    CHECK ("classification_method" IN ('resource_type', 'rule', 'manual', 'unclassified')),
  CONSTRAINT "material_register_items_confidence_check"
    CHECK ("confidence" IN ('high', 'medium', 'low'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "material_register_items_workflow_material_uq"
  ON "material_register_items" ("workflow_id", "project_material_id");
CREATE UNIQUE INDEX IF NOT EXISTS "material_register_items_workflow_fingerprint_uq"
  ON "material_register_items" ("workflow_id", "fingerprint");
CREATE INDEX IF NOT EXISTS "material_register_items_workflow_class_idx"
  ON "material_register_items" ("workflow_id", "classification");
CREATE INDEX IF NOT EXISTS "material_register_items_project_material_id_idx"
  ON "material_register_items" ("project_material_id");

CREATE TABLE IF NOT EXISTS "material_register_source_links" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "workflow_id" INTEGER NOT NULL REFERENCES "execution_workflows"("id") ON DELETE CASCADE,
  "item_id" BIGINT NOT NULL REFERENCES "material_register_items"("id") ON DELETE CASCADE,
  "estimate_id" INTEGER NOT NULL REFERENCES "estimates"("id") ON DELETE CASCADE,
  "estimate_position_id" INTEGER NOT NULL REFERENCES "estimate_positions"("id") ON DELETE CASCADE,
  "position_resource_id" INTEGER REFERENCES "position_resources"("id") ON DELETE CASCADE,
  "schedule_task_id" INTEGER REFERENCES "schedule_tasks"("id") ON DELETE SET NULL,
  "source_type" TEXT NOT NULL,
  "source_name" TEXT NOT NULL,
  "source_unit" TEXT,
  "source_quantity" NUMERIC(20, 4),
  "normalized_name" TEXT NOT NULL,
  "normalized_unit" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "material_register_source_links_source_type_check" CHECK (
    ("source_type" = 'resource' AND "position_resource_id" IS NOT NULL)
    OR ("source_type" = 'position' AND "position_resource_id" IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS "material_register_source_links_item_id_idx"
  ON "material_register_source_links" ("item_id");
CREATE INDEX IF NOT EXISTS "material_register_source_links_estimate_position_id_idx"
  ON "material_register_source_links" ("estimate_position_id");
CREATE INDEX IF NOT EXISTS "material_register_source_links_position_resource_id_idx"
  ON "material_register_source_links" ("position_resource_id");
CREATE INDEX IF NOT EXISTS "material_register_source_links_schedule_task_id_idx"
  ON "material_register_source_links" ("schedule_task_id");
CREATE UNIQUE INDEX IF NOT EXISTS "material_register_source_links_workflow_resource_uq"
  ON "material_register_source_links" ("workflow_id", "position_resource_id")
  WHERE "position_resource_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "material_register_source_links_workflow_position_uq"
  ON "material_register_source_links" ("workflow_id", "estimate_position_id")
  WHERE "position_resource_id" IS NULL;

CREATE TABLE IF NOT EXISTS "material_register_requirements" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "item_id" BIGINT NOT NULL REFERENCES "material_register_items"("id") ON DELETE CASCADE,
  "rule_id" TEXT NOT NULL,
  "document_type" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "material_register_requirements_document_type_check"
    CHECK ("document_type" IN ('certificate', 'declaration', 'passport', 'protocol', 'scheme', 'other'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "material_register_requirements_item_rule_document_uq"
  ON "material_register_requirements" ("item_id", "rule_id", "document_type");
CREATE INDEX IF NOT EXISTS "material_register_requirements_item_document_type_idx"
  ON "material_register_requirements" ("item_id", "document_type");

-- Safe rollback: drop material_register_requirements, material_register_source_links,
-- material_register_items, material_register_states; then drop the generated index,
-- task_materials_source_check and task_materials.source. Project materials, documents,
-- bindings, schedules and manual task-material rows remain intact.
