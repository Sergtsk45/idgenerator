import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  QUALITY_DOCUMENT_PDF_MIME,
  QUALITY_DOCUMENT_UPLOAD_MAX_BYTES,
  isPdfFilename,
  isQualityDocumentPdf,
  newQualityDocumentStorageKey,
  readQualityDocumentUpload,
  removeQualityDocumentUpload,
  resolveQualityDocumentUpload,
  saveQualityDocumentUpload,
} from "../server/quality-document-upload-files.ts";

test("quality document upload accepts only PDF names, MIME contract and PDF signature", () => {
  assert.equal(QUALITY_DOCUMENT_UPLOAD_MAX_BYTES, 50 * 1024 * 1024);
  assert.equal(QUALITY_DOCUMENT_PDF_MIME, "application/pdf");
  assert.equal(isPdfFilename("passport.PDF"), true);
  assert.equal(isPdfFilename("passport.pdf.exe"), false);
  assert.equal(isQualityDocumentPdf(Buffer.from("%PDF-1.7\n")), true);
  assert.equal(isQualityDocumentPdf(Buffer.from("%PDF")), false);
  assert.equal(isQualityDocumentPdf(Buffer.from("PK zip")), false);
});

test("quality document staging uses an unpredictable key and cannot escape its root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "quality-document-upload-test-"));
  const previous = process.env.QUALITY_DOCUMENT_UPLOAD_DIR;
  process.env.QUALITY_DOCUMENT_UPLOAD_DIR = root;
  try {
    const key = newQualityDocumentStorageKey();
    const contents = Buffer.from("%PDF-1.7\nminimal");
    assert.match(key, /^[0-9a-f-]{36}\.pdf$/);
    await saveQualityDocumentUpload(key, contents);
    assert.deepEqual(await readQualityDocumentUpload(key), contents);
    await assert.rejects(() => saveQualityDocumentUpload(key, contents), { code: "EEXIST" });
    assert.throws(() => resolveQualityDocumentUpload("../escape.pdf"));
    assert.throws(() => resolveQualityDocumentUpload("not-a-uuid.pdf"));
    await removeQualityDocumentUpload(key);
    await removeQualityDocumentUpload(key);
  } finally {
    if (previous === undefined) delete process.env.QUALITY_DOCUMENT_UPLOAD_DIR;
    else process.env.QUALITY_DOCUMENT_UPLOAD_DIR = previous;
    await rm(root, { recursive: true, force: true });
  }
});
