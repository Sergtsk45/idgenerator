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
  assert.match(sql, /SET\s+"deleted_at" = now\(\)/);
  assert.match(sql, /unresolved_project_documents/);
  assert.match(sql, /scopeMigration0026/);
  assert.match(sql, /soft_deleted_before_scope_check/);
  assert.match(sql, /no_binding_object/);
  assert.match(sql, /conflicting_binding_objects/);
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

test("storage uses one in-use guard for project/global deletes and clears bindings after soft-delete", async () => {
  const storage = await readFile("server/storage.ts", "utf8");

  assert.match(storage, /private async isDocumentInUse\(tx: any,\s+documentId: number\)/);
  assert.match(storage, /from\(actDocumentAttachments\)[\s\S]*eq\(actDocumentAttachments\.documentId,\s+documentId as any\)/);
  assert.match(storage, /from\(actMaterialUsages\)[\s\S]*eq\(actMaterialUsages\.qualityDocumentId,\s+documentId as any\)/);
  assert.match(storage, /from\(taskMaterials\)[\s\S]*eq\(taskMaterials\.qualityDocumentId,\s+documentId as any\)/);
  assert.match(storage, /if \(await this\.isDocumentInUse\(tx,\s+id\)\) \{\s+throw new DocumentInUseError\(\);\s+\}/);
  assert.match(storage, /update\(documents\)[\s\S]*set\(\{ deletedAt: new Date\(\) \} as any\)[\s\S]*delete\(documentBindings\)\.where\(eq\(documentBindings\.documentId,\s+id as any\)\)/);
});

test("storage refuses global-to-project scope demotion", async () => {
  const storage = await readFile("server/storage.ts", "utf8");

  assert.match(storage, /if \(scope !== "global"\) return undefined;/);
  assert.match(storage, /if \(existing\.scope === "global"\) return existing;/);
  assert.match(storage, /scope: "global",\s+objectId: null/s);
});

test("documents audit migration adds nullable user references and indexes", async () => {
  const sql = await readFile("migrations/0027_documents_audit_user_ids.sql", "utf8");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS "created_by_user_id" INTEGER/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "updated_by_user_id" INTEGER/);
  assert.match(sql, /documents_created_by_user_id_fkey/);
  assert.match(sql, /documents_updated_by_user_id_fkey/);
  assert.match(sql, /ON DELETE SET NULL/);
  assert.match(sql, /documents_created_by_user_id_idx/);
  assert.match(sql, /documents_updated_by_user_id_idx/);
});
