/**
 * @file: document-bindings-delete-contract.test.ts
 * @description: Контракт API для удаления привязки документа.
 * @dependencies: node:test, node:assert/strict, shared/routes.ts
 * @created: 2026-07-22
 */

import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../shared/routes.ts";

test("documentBindings.delete contract exposes expected method/path", () => {
  assert.equal(api.documentBindings.delete.method, "DELETE");
  assert.equal(api.documentBindings.delete.path, "/api/document-bindings/:id");
});

test("documentBindings.delete response schemas parse expected payloads", () => {
  assert.doesNotThrow(() => api.documentBindings.delete.responses[204].parse(null));
  assert.doesNotThrow(() => api.documentBindings.delete.responses[400].parse({ message: "Invalid id" }));
  assert.doesNotThrow(() => api.documentBindings.delete.responses[404].parse({ message: "Not found" }));
});
