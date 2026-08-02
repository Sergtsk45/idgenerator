-- TASK-002: persistent execution workflow state machine (MCP-IDgenerator MVP).
-- Adds execution_workflows, execution_workflow_inputs, execution_workflow_events,
-- tool_idempotency_records. Source of truth for multi-step agent scenario lives here,
-- independent of chat history.

CREATE TABLE IF NOT EXISTS "execution_workflows" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "object_id" INTEGER NOT NULL REFERENCES "objects"("id"),
  "estimate_id" INTEGER REFERENCES "estimates"("id") ON DELETE SET NULL,
  "schedule_id" INTEGER REFERENCES "schedules"("id") ON DELETE SET NULL,
  "stage" TEXT NOT NULL DEFAULT 'created',
  "status" TEXT NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "execution_workflows_stage_check" CHECK ("stage" IN (
    'created', 'estimate_upload_pending', 'estimate_imported', 'estimate_analysis_ready',
    'awaiting_schedule_inputs', 'schedule_draft_ready', 'schedule_approved',
    'materials_register_ready', 'awaiting_quality_documents', 'acts_blocked',
    'acts_ready', 'acts_generated', 'worklog_draft_ready', 'package_ready',
    'completed', 'failed'
  )),
  CONSTRAINT "execution_workflows_status_check" CHECK ("status" IN ('active', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS "execution_workflows_user_id_idx" ON "execution_workflows" ("user_id");
CREATE INDEX IF NOT EXISTS "execution_workflows_object_id_idx" ON "execution_workflows" ("object_id");

CREATE TABLE IF NOT EXISTS "execution_workflow_inputs" (
  "id" SERIAL PRIMARY KEY,
  "workflow_id" INTEGER NOT NULL REFERENCES "execution_workflows"("id") ON DELETE CASCADE,
  "key" TEXT NOT NULL,
  "value_json" JSONB,
  "source" TEXT NOT NULL,
  "confirmed" BOOLEAN NOT NULL DEFAULT FALSE,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "execution_workflow_inputs_source_check" CHECK ("source" IN ('user', 'estimate', 'system_default', 'calculated'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "execution_workflow_inputs_workflow_key_uq"
  ON "execution_workflow_inputs" ("workflow_id", "key");

-- Append-only audit trail. Application code must never UPDATE/DELETE rows here.
CREATE TABLE IF NOT EXISTS "execution_workflow_events" (
  "id" SERIAL PRIMARY KEY,
  "workflow_id" INTEGER NOT NULL REFERENCES "execution_workflows"("id") ON DELETE CASCADE,
  "event_type" TEXT NOT NULL,
  "actor_type" TEXT NOT NULL,
  "actor_id" TEXT,
  "payload_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "execution_workflow_events_actor_type_check" CHECK ("actor_type" IN ('user', 'agent', 'system'))
);

CREATE INDEX IF NOT EXISTS "execution_workflow_events_workflow_id_idx" ON "execution_workflow_events" ("workflow_id");
CREATE INDEX IF NOT EXISTS "execution_workflow_events_workflow_id_created_at_idx"
  ON "execution_workflow_events" ("workflow_id", "created_at");

CREATE TABLE IF NOT EXISTS "tool_idempotency_records" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "tool_name" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "result_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "tool_idempotency_records_user_tool_key_uq"
  ON "tool_idempotency_records" ("user_id", "tool_name", "idempotency_key");

-- Rollback plan: DROP TABLE "tool_idempotency_records", "execution_workflow_events",
-- "execution_workflow_inputs", "execution_workflows" (in this order) is safe; no other
-- table references them yet.
