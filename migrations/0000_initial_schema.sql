-- @file: 0000_initial_schema.sql
-- @description: Bootstrap migration — creates all base tables that subsequent migrations depend on.
--   Must run first. All tables here were historically bootstrapped outside of migrations
--   (via drizzle-kit push) and are referenced (but never created) by migrations 0001–0011.
--   Current policy: only SQL migrations are used; drizzle-kit push is not applied.
-- @created: 2026-02-20
--
-- Columns intentionally omitted (added by later migrations):
--   acts.object_id              → 0001_objects_source_data.sql (ADD COLUMN IF NOT EXISTS)
--   acts.act_template_id        → 0010_act_from_schedule_task_data.sql (ADD COLUMN IF NOT EXISTS)
--   acts.project_drawings_agg   → 0010 (ADD COLUMN IF NOT EXISTS)
--   acts.normative_refs_agg     → 0010 (ADD COLUMN IF NOT EXISTS)
--   acts.executive_schemes_agg  → 0010 (ADD COLUMN IF NOT EXISTS)
--   schedules.source_type       → 0006_schedule_estimate_source.sql (ADD COLUMN — no IF NOT EXISTS)
--   schedules.estimate_id       → 0006 (ADD COLUMN — no IF NOT EXISTS)
--   schedule_tasks.estimate_position_id → 0006 (ADD COLUMN — no IF NOT EXISTS)
--   schedule_tasks.act_template_id      → 0010 (ADD COLUMN IF NOT EXISTS)
--   schedule_tasks.project_drawings     → 0010 (ADD COLUMN IF NOT EXISTS)
--   schedule_tasks.normative_refs       → 0010 (ADD COLUMN IF NOT EXISTS)
--   schedule_tasks.executive_schemes    → 0010 (ADD COLUMN IF NOT EXISTS)
--   schedule_tasks.quantity             → 0011_schedule_task_quantity.sql (ADD COLUMN IF NOT EXISTS)
--   schedule_tasks.unit                 → 0011 (ADD COLUMN IF NOT EXISTS)

-- ----
-- 1) works — Bill of Quantities (ведомость объёмов работ), no FK dependencies
-- ----

CREATE TABLE IF NOT EXISTS "works" (
  "id"             SERIAL PRIMARY KEY,
  "code"           TEXT NOT NULL,
  "description"    TEXT NOT NULL,
  "unit"           TEXT NOT NULL,
  "quantity_total" NUMERIC(20, 4),
  "synonyms"       JSONB
);

-- ----
-- 2) act_templates — catalog of AOSR act types, no FK dependencies
-- ----

CREATE TABLE IF NOT EXISTS "act_templates" (
  "id"            SERIAL PRIMARY KEY,
  "template_id"   TEXT NOT NULL UNIQUE,
  "code"          TEXT NOT NULL,
  "category"      TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "title_en"      TEXT,
  "description"   TEXT,
  "normative_ref" TEXT,
  "is_active"     BOOLEAN DEFAULT TRUE
);

-- ----
-- 3) messages — raw and normalized Telegram messages, no FK dependencies
-- ----

CREATE TABLE IF NOT EXISTS "messages" (
  "id"              SERIAL PRIMARY KEY,
  "user_id"         TEXT NOT NULL,
  "message_raw"     TEXT NOT NULL,
  "normalized_data" JSONB,
  "created_at"      TIMESTAMP DEFAULT now(),
  "is_processed"    BOOLEAN DEFAULT FALSE
);

-- ----
-- 4) acts — AOSR acts
--    object_id is added later by 0001 (ADD COLUMN IF NOT EXISTS).
--    act_template_id and *_agg fields are added later by 0010 (ADD COLUMN IF NOT EXISTS).
-- ----

CREATE TABLE IF NOT EXISTS "acts" (
  "id"         SERIAL PRIMARY KEY,
  "act_number" INTEGER UNIQUE,
  "date_start" DATE,
  "date_end"   DATE,
  "location"   TEXT,
  "status"     TEXT DEFAULT 'draft',
  "works_data" JSONB,
  "created_at" TIMESTAMP DEFAULT now()
);

-- ----
-- 5) attachments — documents attached to acts
-- ----

CREATE TABLE IF NOT EXISTS "attachments" (
  "id"         SERIAL PRIMARY KEY,
  "act_id"     INTEGER REFERENCES "acts"("id"),
  "url"        TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "type"       TEXT,
  "created_at" TIMESTAMP DEFAULT now()
);

-- ----
-- 6) act_template_selections — selected act templates per act
-- ----

CREATE TABLE IF NOT EXISTS "act_template_selections" (
  "id"           SERIAL PRIMARY KEY,
  "act_id"       INTEGER REFERENCES "acts"("id"),
  "template_id"  INTEGER REFERENCES "act_templates"("id"),
  "status"       TEXT DEFAULT 'pending',
  "pdf_url"      TEXT,
  "generated_at" TIMESTAMP
);

-- ----
-- 7) schedules — Gantt schedules
--    source_type and estimate_id are added later by 0006 (ADD COLUMN, no IF NOT EXISTS guard).
--    Including them here would break 0006 with "column already exists".
-- ----

CREATE TABLE IF NOT EXISTS "schedules" (
  "id"             SERIAL PRIMARY KEY,
  "title"          TEXT NOT NULL,
  "calendar_start" DATE,
  "created_at"     TIMESTAMP DEFAULT now()
);

-- ----
-- 8) schedule_tasks — tasks within a Gantt schedule
--    work_id is NOT NULL here; 0006 will ALTER COLUMN work_id DROP NOT NULL.
--    estimate_position_id is added by 0006 (ADD COLUMN, no IF NOT EXISTS guard).
--    act_template_id, project_drawings, normative_refs, executive_schemes → 0010.
--    quantity, unit → 0011.
-- ----

CREATE TABLE IF NOT EXISTS "schedule_tasks" (
  "id"             SERIAL PRIMARY KEY,
  "schedule_id"    INTEGER NOT NULL REFERENCES "schedules"("id"),
  "work_id"        INTEGER NOT NULL REFERENCES "works"("id"),
  "act_number"     INTEGER,
  "title_override" TEXT,
  "start_date"     DATE NOT NULL,
  "duration_days"  INTEGER NOT NULL,
  "order_index"    INTEGER NOT NULL,
  "created_at"     TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "schedule_tasks_schedule_id_idx"
  ON "schedule_tasks" ("schedule_id");

CREATE INDEX IF NOT EXISTS "schedule_tasks_work_id_idx"
  ON "schedule_tasks" ("work_id");

CREATE INDEX IF NOT EXISTS "schedule_tasks_schedule_order_idx"
  ON "schedule_tasks" ("schedule_id", "order_index");

CREATE INDEX IF NOT EXISTS "schedule_tasks_schedule_act_number_idx"
  ON "schedule_tasks" ("schedule_id", "act_number");
