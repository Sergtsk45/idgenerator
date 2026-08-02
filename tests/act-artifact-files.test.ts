import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  newActArtifactStorageKey,
  readActArtifactFile,
  removeActArtifactFile,
  resolveActArtifactFile,
  saveActArtifactFile,
} from "../server/act-artifact-files.ts";

test("act artifact files use opaque PDF keys, reject traversal and never overwrite", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "act-artifacts-"));
  const previousRoot = process.env.ACT_ARTIFACTS_DIR;
  process.env.ACT_ARTIFACTS_DIR = root;

  try {
    for (const invalid of ["../foreign.pdf", "/tmp/foreign.pdf", "foreign.pdf", "00000000-0000-0000-0000-000000000000.pdf/extra"]) {
      assert.throws(() => resolveActArtifactFile(invalid), /Invalid act artifact storage key/);
    }

    const storageKey = newActArtifactStorageKey();
    assert.match(storageKey, /^[0-9a-f-]{36}\.pdf$/);
    assert.equal(path.dirname(resolveActArtifactFile(storageKey)), root);

    const first = Buffer.from("%PDF-1.7\nTASK-009");
    await saveActArtifactFile(storageKey, first);
    assert.deepEqual(await readActArtifactFile(storageKey), first);
    await assert.rejects(() => saveActArtifactFile(storageKey, Buffer.from("replacement")));
    assert.deepEqual(await readActArtifactFile(storageKey), first);

    await removeActArtifactFile(storageKey);
    await assert.rejects(() => readActArtifactFile(storageKey), { code: "ENOENT" });
    await assert.doesNotReject(() => removeActArtifactFile(storageKey));
  } finally {
    if (previousRoot === undefined) delete process.env.ACT_ARTIFACTS_DIR;
    else process.env.ACT_ARTIFACTS_DIR = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});
