-- TASK-010: deterministic worklog drafts and owner-scoped execution packages.
CREATE TABLE IF NOT EXISTS "worklog_drafts" (
  "id" SERIAL PRIMARY KEY,
  "workflow_id" INTEGER NOT NULL REFERENCES "execution_workflows"("id") ON DELETE CASCADE,
  "object_id" INTEGER NOT NULL REFERENCES "objects"("id") ON DELETE CASCADE,
  "input_hash" TEXT NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "entries_json" JSONB NOT NULL,
  "warnings_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "worklog_drafts_workflow_input_uq" UNIQUE ("workflow_id", "input_hash", "schema_version")
);
CREATE INDEX IF NOT EXISTS "worklog_drafts_workflow_id_idx" ON "worklog_drafts" ("workflow_id");

CREATE TABLE IF NOT EXISTS "execution_packages" (
  "id" TEXT PRIMARY KEY,
  "workflow_id" INTEGER NOT NULL REFERENCES "execution_workflows"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "object_id" INTEGER NOT NULL REFERENCES "objects"("id") ON DELETE CASCADE,
  "mode" TEXT NOT NULL,
  "input_hash" TEXT NOT NULL,
  "manifest_json" JSONB NOT NULL,
  "storage_key" TEXT NOT NULL UNIQUE,
  "filename" TEXT NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "sha256" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "execution_packages_mode_check" CHECK ("mode" IN ('draft', 'final')),
  CONSTRAINT "execution_packages_workflow_mode_input_uq" UNIQUE ("workflow_id", "mode", "input_hash")
);
CREATE INDEX IF NOT EXISTS "execution_packages_user_object_idx" ON "execution_packages" ("user_id", "object_id");
