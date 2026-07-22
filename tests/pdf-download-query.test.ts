/**
 * @file: pdf-download-query.test.ts
 * @description: Тест query-параметра download для ссылок PDF.
 * @dependencies: node:test, node:assert/strict, client/src/lib/pdf-download.ts
 * @created: 2026-07-22
 */

import test from "node:test";
import assert from "node:assert/strict";
import { withDownloadQuery } from "../client/src/lib/pdf-download.ts";

test("withDownloadQuery appends download=1 without breaking existing query", () => {
  assert.equal(withDownloadQuery("/api/pdfs/file.pdf"), "/api/pdfs/file.pdf?download=1");
  assert.equal(
    withDownloadQuery("/api/pdfs/file.pdf?token=abc"),
    "/api/pdfs/file.pdf?token=abc&download=1",
  );
});
