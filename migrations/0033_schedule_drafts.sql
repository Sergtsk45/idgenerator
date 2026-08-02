-- TASK-006: versioned deterministic schedule drafts and one-time approval linkage.

CREATE TABLE IF NOT EXISTS "schedule_drafts" (
  "id" SERIAL PRIMARY KEY,
  "workflow_id" INTEGER NOT NULL REFERENCES "execution_workflows"("id") ON DELETE CASCADE,
  "estimate_id" INTEGER NOT NULL REFERENCES "estimates"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL,
  "planner_version" TEXT NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "input_hash" TEXT NOT NULL,
  "draft_json" JSONB NOT NULL,
  "approved_schedule_id" INTEGER REFERENCES "schedules"("id") ON DELETE SET NULL,
  "approved_at" TIMESTAMPTZ,
  CONSTRAINT "schedule_drafts_version_check" CHECK ("version" > 0),
  CONSTRAINT "schedule_drafts_schema_version_check" CHECK ("schema_version" > 0),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "schedule_drafts_workflow_id_idx"
  ON "schedule_drafts" ("workflow_id");
CREATE INDEX IF NOT EXISTS "schedule_drafts_estimate_id_idx"
  ON "schedule_drafts" ("estimate_id");
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_drafts_workflow_version_uq"
  ON "schedule_drafts" ("workflow_id", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_drafts_input_version_uq"
  ON "schedule_drafts" ("workflow_id", "input_hash", "planner_version", "schema_version");

-- Safe rollback: DROP TABLE "schedule_drafts". Only derived drafts and their
-- approval links are removed; approved schedules and tasks remain intact.
