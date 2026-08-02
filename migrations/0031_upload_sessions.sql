-- TASK-003: one-shot, owner-scoped upload sessions for estimate XLSX files.

CREATE TABLE IF NOT EXISTS "upload_sessions" (
  "id" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "object_id" INTEGER NOT NULL REFERENCES "objects"("id") ON DELETE CASCADE,
  "workflow_id" INTEGER NOT NULL REFERENCES "execution_workflows"("id") ON DELETE CASCADE,
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "storage_key" TEXT NOT NULL UNIQUE,
  "original_filename" TEXT NOT NULL,
  "mime_type" TEXT,
  "size_bytes" BIGINT,
  "sha256" TEXT,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "uploaded_at" TIMESTAMPTZ,
  "consumed_at" TIMESTAMPTZ,
  "estimate_id" INTEGER REFERENCES "estimates"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "upload_sessions_purpose_check" CHECK ("purpose" IN ('estimate')),
  CONSTRAINT "upload_sessions_status_check" CHECK ("status" IN ('pending', 'uploaded', 'consumed'))
);

CREATE INDEX IF NOT EXISTS "upload_sessions_user_id_idx" ON "upload_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "upload_sessions_workflow_id_idx" ON "upload_sessions" ("workflow_id");
CREATE INDEX IF NOT EXISTS "upload_sessions_expires_at_idx" ON "upload_sessions" ("expires_at");

-- Rollback: DROP TABLE "upload_sessions". Imported estimates are intentionally retained.
