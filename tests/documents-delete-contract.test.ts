/**
 * @file: documents-delete-contract.test.ts
 * @description: Контракт API для удаления документов (responses 204/400/401/404/409).
 * @dependencies: node:test, node:assert/strict, shared/routes.ts
 * @created: 2026-07-22
 */

import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../shared/routes.ts";

test("documents.delete contract exposes expected method/path", () => {
  assert.equal(api.documents.delete.method, "DELETE");
  assert.equal(api.documents.delete.path, "/api/documents/:id");
});

test("documents.delete response schemas parse expected payloads", () => {
  assert.doesNotThrow(() => api.documents.delete.responses[204].parse(null));
  assert.doesNotThrow(() => api.documents.delete.responses[400].parse({ message: "Invalid id" }));
  assert.doesNotThrow(() => api.documents.delete.responses[401].parse({ error: "Authentication required" }));
  assert.doesNotThrow(() => api.documents.delete.responses[404].parse({ message: "Not found" }));
  assert.doesNotThrow(() => api.documents.delete.responses[409].parse({ message: "Document is used in acts" }));
});
