/**
 * @file: documents-object-scoping-implementation.test.ts
 * @description: Smoke-тесты реализации object-scoped видимости документов и миграции backfill.
 * @dependencies: node:test, node:assert/strict, node:fs/promises
 * @created: 2026-07-24
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("documents object-id migration adds FK, indexes, backfill and active-row scope check", async () => {
  const sql = await readFile("migrations/0026_documents_object_id.sql", "utf8");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS "object_id" INTEGER/);
  assert.match(sql, /FOREIGN KEY \("object_id"\)\s+REFERENCES "objects"\("id"\)\s+ON DELETE CASCADE/s);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS "documents_object_id_idx"/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS "documents_scope_object_idx"\s+ON "documents" \("scope", "object_id"\)/);
  assert.match(sql, /JOIN "project_materials" pm\s+ON pm\."id" = db\."project_material_id"/);
  assert.match(sql, /JOIN "material_batches" mb\s+ON mb\."id" = db\."batch_id"/);
  assert.match(sql, /SET "deleted_at" = now\(\)/);
  assert.match(sql, /"deleted_at" IS NOT NULL\s+OR \("scope" = 'global' AND "object_id" IS NULL\)\s+OR \("scope" = 'project' AND "object_id" IS NOT NULL\)/);
});

test("storage document visibility is current-object project plus global for all mode", async () => {
  const storage = await readFile("server/storage.ts", "utf8");

  assert.match(storage, /searchDocuments\(params: \{ objectId: number; viewMode\?: DocumentViewMode; query\?: string; docType\?: string \}\)/);
  assert.match(storage, /viewMode === "global"\s+\?\s+eq\(documents\.scope, "global"\)/);
  assert.match(storage, /viewMode === "all"\s+\?\s+or\(eq\(documents\.scope, "global"\), eq\(documents\.objectId, params\.objectId as any\)\)/);
  assert.match(storage, /and\(eq\(documents\.scope, "project"\), eq\(documents\.objectId, params\.objectId as any\)\)/);
  assert.match(storage, /isNull\(documents\.deletedAt\)/);
});

