import assert from "node:assert/strict";
import test from "node:test";

import { buildZipArchive } from "../server/services/execution-package/zipArchive.ts";

test("store-only ZIP is deterministic and rejects unsafe or duplicate entry names", () => {
  const entries = [{ name: "manifest.json", contents: Buffer.from("{}") }, { name: "worklog/draft.json", contents: Buffer.from("[]") }];
  const zip = buildZipArchive(entries);
  assert.deepEqual(zip, buildZipArchive(entries));
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const firstNameLength = zip.readUInt16LE(26);
  assert.equal(zip.subarray(30, 30 + firstNameLength).toString(), "manifest.json");
  assert.throws(() => buildZipArchive([{ name: "../secret", contents: Buffer.alloc(0) }]));
  assert.throws(() => buildZipArchive([{ name: "a", contents: Buffer.alloc(0) }, { name: "a", contents: Buffer.alloc(0) }]));
  assert.throws(() => buildZipArchive([{ name: "large", contents: Buffer.alloc(2) }], { maxEntryBytes: 1 }), /entry size/);
  assert.throws(() => buildZipArchive([
    { name: "a", contents: Buffer.alloc(1) },
    { name: "b", contents: Buffer.alloc(1) },
  ], { maxTotalBytes: 1 }), /total size/);
  const crcZip = buildZipArchive([{ name: "crc.txt", contents: Buffer.from("123456789") }]);
  assert.equal(crcZip.readUInt32LE(14), 0xcbf43926);
});
