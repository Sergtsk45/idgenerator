/**
 * @file: documents-fileurl-schema.test.ts
 * @description: Проверка server-side схемы fileUrl в API создания документов.
 * @dependencies: node:test, node:assert/strict, shared/routes.ts
 * @created: 2026-07-22
 */

import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../shared/routes.ts";

const basePayload = {
  docType: "certificate" as const,
  scope: "project" as const,
  title: "Test document",
};

test("documents.create accepts http/https fileUrl", () => {
  const httpParsed = api.documents.create.input.parse({
    ...basePayload,
    fileUrl: "http://example.com/doc.pdf",
  });
  const httpsParsed = api.documents.create.input.parse({
    ...basePayload,
    fileUrl: "https://example.com/doc.pdf",
  });

  assert.equal(httpParsed.fileUrl, "http://example.com/doc.pdf");
  assert.equal(httpsParsed.fileUrl, "https://example.com/doc.pdf");
});

test("documents.create rejects non-http protocols", () => {
  assert.throws(() =>
    api.documents.create.input.parse({
      ...basePayload,
      fileUrl: "javascript:alert(1)",
    }),
  );
});
