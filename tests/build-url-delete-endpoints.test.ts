/**
 * @file: build-url-delete-endpoints.test.ts
 * @description: Проверка подстановки id в delete endpoints через buildUrl.
 * @dependencies: node:test, node:assert/strict, shared/routes.ts
 * @created: 2026-07-22
 */

import test from "node:test";
import assert from "node:assert/strict";
import { api, buildUrl } from "../shared/routes.ts";

test("buildUrl replaces :id in documents.delete path", () => {
  const url = buildUrl(api.documents.delete.path, { id: 42 });
  assert.equal(url, "/api/documents/42");
});

test("buildUrl replaces :id in documentBindings.delete path", () => {
  const url = buildUrl(api.documentBindings.delete.path, { id: 77 });
  assert.equal(url, "/api/document-bindings/77");
});
