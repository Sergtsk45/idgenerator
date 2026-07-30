import assert from "node:assert/strict";
import test from "node:test";
import { resolveQualityDocumentId } from "../shared/documentBinding.ts";

test("quality document fallback prefers primary useInActs passport", () => {
  assert.equal(
    resolveQualityDocumentId([
      { documentId: 1, bindingRole: "quality", useInActs: true, isPrimary: false },
      { documentId: 2, bindingRole: "passport", useInActs: true, isPrimary: true },
      { documentId: 3, bindingRole: "scheme", useInActs: true, isPrimary: true },
    ]),
    2,
  );
});

test("quality document fallback uses quality roles only", () => {
  assert.equal(
    resolveQualityDocumentId([
      { documentId: 1, bindingRole: "scheme", useInActs: true, isPrimary: true },
      { documentId: 2, bindingRole: "protocol", useInActs: false, isPrimary: false },
    ]),
    2,
  );
  assert.equal(resolveQualityDocumentId([{ documentId: 3, bindingRole: "other", useInActs: true }]), null);
});

test("useInActs wins over a primary binding that is not enabled for acts", () => {
  assert.equal(
    resolveQualityDocumentId([
      { documentId: 1, bindingRole: "passport", useInActs: false, isPrimary: true },
      { documentId: 2, bindingRole: "quality", useInActs: true, isPrimary: false },
    ]),
    2,
  );
});
