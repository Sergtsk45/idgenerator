/**
 * @file: documents-scope-contract.test.ts
 * @description: Контракты API документов для object-scoped режимов просмотра, patch и смены scope.
 * @dependencies: node:test, node:assert/strict, shared/routes.ts
 * @created: 2026-07-24
 */

import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../shared/routes.ts";

test("documents.list accepts project/global/all view modes", () => {
  assert.equal(api.documents.list.input?.parse({}).viewMode, "project");
  assert.equal(api.documents.list.input?.parse({ viewMode: "global" }).viewMode, "global");
  assert.equal(api.documents.list.input?.parse({ viewMode: "all", query: "cert", docType: "certificate" }).viewMode, "all");
  assert.throws(() => api.documents.list.input?.parse({ viewMode: "foreign" }));
});

test("documents.patch exposes expected method/path and validates editable fields", () => {
  assert.equal(api.documents.patch.method, "PATCH");
  assert.equal(api.documents.patch.path, "/api/documents/:id");

  const parsed = api.documents.patch.input.parse({
    title: "Updated title",
    docNumber: null,
    fileUrl: "https://example.com/document.pdf",
  });

  assert.equal(parsed.title, "Updated title");
  assert.equal(parsed.docNumber, null);
  assert.throws(() => api.documents.patch.input.parse({}));
  assert.throws(() => api.documents.patch.input.parse({ fileUrl: "ftp://example.com/document.pdf" }));
});

test("documents.setScope exposes expected method/path and accepts project/global", () => {
  assert.equal(api.documents.setScope.method, "PATCH");
  assert.equal(api.documents.setScope.path, "/api/documents/:id/scope");
  assert.equal(api.documents.setScope.input.parse({ scope: "global" }).scope, "global");
  assert.equal(api.documents.setScope.input.parse({ scope: "project" }).scope, "project");
  assert.throws(() => api.documents.setScope.input.parse({ scope: "team" }));
});

