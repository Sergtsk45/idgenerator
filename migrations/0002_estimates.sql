-- @file: 0002_estimates.sql
-- @description: Create estimates (ЛСР/Смета) tables: estimates, sections, positions, resources
-- @created: 2026-01-29

-- NOTE: Единственный способ изменения БД — SQL-миграции (этот файл).
-- drizzle-kit используется только для генерации миграций (`drizzle-kit generate`).
-- `drizzle-kit push` в проекте не применяется.

CREATE TABLE IF NOT EXISTS "estimates" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "object_name" TEXT,
  "region" TEXT,
  "pricing_quarter" TEXT,
  "total_cost" NUMERIC(20, 4),
  "total_construction" NUMERIC(20, 4),
  "total_installation" NUMERIC(20, 4),
  "total_equipment" NUMERIC(20, 4),
  "total_other" NUMERIC(20, 4),
  "created_at" TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "estimate_sections" (
  "id" SERIAL PRIMARY KEY,
  "estimate_id" INTEGER NOT NULL REFERENCES "estimates"("id"),
  "number" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "order_index" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "estimate_sections_estimate_id_idx"
  ON "estimate_sections" ("estimate_id");

CREATE UNIQUE INDEX IF NOT EXISTS "estimate_sections_estimate_number_uq"
  ON "estimate_sections" ("estimate_id", "number");

CREATE TABLE IF NOT EXISTS "estimate_positions" (
  "id" SERIAL PRIMARY KEY,
  "estimate_id" INTEGER NOT NULL REFERENCES "estimates"("id"),
  "section_id" INTEGER REFERENCES "estimate_sections"("id"),
  "line_no" TEXT NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "unit" TEXT,
  "quantity" NUMERIC(20, 4),
  "base_cost_per_unit" NUMERIC(20, 4),
  "index_value" NUMERIC(20, 6),
  "current_cost_per_unit" NUMERIC(20, 4),
  "total_current_cost" NUMERIC(20, 4),
  "notes" TEXT,
  "order_index" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "estimate_positions_estimate_id_idx"
  ON "estimate_positions" ("estimate_id");

CREATE INDEX IF NOT EXISTS "estimate_positions_section_id_idx"
  ON "estimate_positions" ("section_id");

CREATE INDEX IF NOT EXISTS "estimate_positions_estimate_line_no_idx"
  ON "estimate_positions" ("estimate_id", "line_no");

CREATE TABLE IF NOT EXISTS "position_resources" (
  "id" SERIAL PRIMARY KEY,
  "position_id" INTEGER NOT NULL REFERENCES "estimate_positions"("id"),
  "resource_code" TEXT,
  "resource_type" TEXT,
  "name" TEXT NOT NULL,
  "unit" TEXT,
  "quantity" NUMERIC(20, 4),
  "base_cost_per_unit" NUMERIC(20, 4),
  "current_cost_per_unit" NUMERIC(20, 4),
  "total_current_cost" NUMERIC(20, 4),
  "order_index" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "position_resources_position_id_idx"
  ON "position_resources" ("position_id");

