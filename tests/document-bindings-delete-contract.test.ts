/**
 * @file: document-bindings-delete-contract.test.ts
 * @description: Контракт API для удаления привязки документа.
 * @dependencies: node:test, node:assert/strict, shared/routes.ts
 * @created: 2026-07-22
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { api } from "../shared/routes.ts";

test("documentBindings.delete contract exposes expected method/path", () => {
  assert.equal(api.documentBindings.delete.method, "DELETE");
  assert.equal(api.documentBindings.delete.path, "/api/document-bindings/:id");
});

test("documentBindings.delete response schemas parse expected payloads", () => {
  assert.doesNotThrow(() => api.documentBindings.delete.responses[204].parse(null));
  assert.doesNotThrow(() => api.documentBindings.delete.responses[400].parse({ message: "Invalid id" }));
  assert.doesNotThrow(() => api.documentBindings.delete.responses[401].parse({ error: "Authentication required" }));
  assert.doesNotThrow(() => api.documentBindings.delete.responses[404].parse({ message: "Not found" }));
});

test("documentBindings create and patch contracts require auth-capable responses", () => {
  assert.equal(api.documentBindings.create.method, "POST");
  assert.equal(api.documentBindings.create.path, "/api/document-bindings");
  assert.doesNotThrow(() => api.documentBindings.create.responses[401].parse({ error: "Authentication required" }));
  assert.doesNotThrow(() => api.documentBindings.create.responses[404].parse({ message: "Not found" }));

  assert.equal(api.documentBindings.patch.method, "PATCH");
  assert.equal(api.documentBindings.patch.path, "/api/document-bindings/:id");
  assert.doesNotThrow(() => api.documentBindings.patch.responses[401].parse({ error: "Authentication required" }));
});

test("documentBindings create and patch routes use auth and current-object ownership", async () => {
  const routes = await readFile("server/routes/materials.ts", "utf8");
  const storage = await readFile("server/storage.ts", "utf8");

  assert.match(routes, /app\.post\(api\.documentBindings\.create\.path,\s+\.\.\.appAuth,\s+resolveCurrentObject/s);
  assert.match(routes, /storage\.createBinding\(input as any,\s+\(req as AuthenticatedRequest\)\.user\.id,\s+objectId\)/);
  assert.match(routes, /app\.patch\(api\.documentBindings\.patch\.path,\s+\.\.\.appAuth,\s+resolveCurrentObject/s);
  assert.match(routes, /storage\.updateBinding\(id,\s+\(req as AuthenticatedRequest\)\.user\.id,\s+objectId,\s+patch as any\)/);

  assert.match(storage, /createBinding\(data: InsertDocumentBinding,\s+userId: number,\s+objectId: number\)/);
  assert.match(storage, /isDocumentVisibleForObject\(tx,\s+Number\(data\.documentId\),\s+objectId\)/);
  assert.match(storage, /isBindingTargetOwnedByObject\(tx,\s+data as any,\s+objectId\)/);
  assert.match(storage, /isBindingVisibleForObject\(tx,\s+id,\s+objectId\)/);
  assert.match(storage, /isDocumentVisibleForObject\(tx,\s+Number\(binding\.documentId\),\s+objectId\)/);
});
