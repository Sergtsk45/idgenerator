/**
 * @file: documents-delete-error-handling.test.ts
 * @description: Frontend contract for typed document delete API errors.
 * @dependencies: node:test, node:assert/strict, client/src/hooks/use-documents.ts
 * @created: 2026-07-24
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createApiError } from "../client/src/hooks/use-documents.ts";

test("document delete errors preserve HTTP status for 409 UX handling", () => {
  const error = createApiError("Document is used in acts", 409);

  assert.equal(error.message, "Document is used in acts");
  assert.equal(error.status, 409);
});
