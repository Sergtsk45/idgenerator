-- TASK-004: append-only deterministic estimate analysis snapshots.

CREATE TABLE IF NOT EXISTS "estimate_analysis_snapshots" (
  "id" SERIAL PRIMARY KEY,
  "workflow_id" INTEGER NOT NULL REFERENCES "execution_workflows"("id") ON DELETE CASCADE,
  "estimate_id" INTEGER NOT NULL REFERENCES "estimates"("id") ON DELETE CASCADE,
  "analysis_version" TEXT NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "input_hash" TEXT NOT NULL,
  "analysis_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "estimate_analysis_snapshots_workflow_id_idx"
  ON "estimate_analysis_snapshots" ("workflow_id");
CREATE INDEX IF NOT EXISTS "estimate_analysis_snapshots_estimate_id_idx"
  ON "estimate_analysis_snapshots" ("estimate_id");
CREATE UNIQUE INDEX IF NOT EXISTS "estimate_analysis_snapshots_input_version_uq"
  ON "estimate_analysis_snapshots" ("workflow_id", "input_hash", "analysis_version", "schema_version");

-- Safe rollback: DROP TABLE "estimate_analysis_snapshots". Only derived analysis
-- snapshots are removed; estimates and execution workflows remain unchanged.
