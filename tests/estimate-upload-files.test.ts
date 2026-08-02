import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  ESTIMATE_UPLOAD_MAX_BYTES,
  ESTIMATE_XLSX_MIME,
  isXlsx,
  isXlsxFilename,
  newEstimateStorageKey,
  resolveEstimateUpload,
  saveEstimateUpload,
} from "../server/estimate-upload-files.ts";

test("estimate upload validation accepts only XLSX name, MIME contract and ZIP signature", () => {
  assert.equal(ESTIMATE_UPLOAD_MAX_BYTES, 20 * 1024 * 1024);
  assert.equal(ESTIMATE_XLSX_MIME, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(isXlsxFilename("estimate.XLSX"), true);
  assert.equal(isXlsxFilename("estimate.xls"), false);
  assert.equal(isXlsxFilename("estimate.pdf"), false);
  assert.equal(isXlsx(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])), true);
  assert.equal(isXlsx(Buffer.from("%PDF-1.7")), false);
  assert.equal(isXlsx(Buffer.from("MZ executable")), false);
});

test("estimate upload storage uses an unpredictable key and cannot escape its root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "estimate-upload-test-"));
  const previous = process.env.ESTIMATE_UPLOAD_DIR;
  process.env.ESTIMATE_UPLOAD_DIR = root;
  try {
    const key = newEstimateStorageKey();
    assert.match(key, /^[0-9a-f-]{36}\.xlsx$/);
    await saveEstimateUpload(key, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01]));
    assert.deepEqual(await readFile(resolveEstimateUpload(key)), Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01]));
    assert.throws(() => resolveEstimateUpload("../escape.xlsx"));
  } finally {
    if (previous === undefined) delete process.env.ESTIMATE_UPLOAD_DIR;
    else process.env.ESTIMATE_UPLOAD_DIR = previous;
    await rm(root, { recursive: true, force: true });
  }
});
