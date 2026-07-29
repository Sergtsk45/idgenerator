import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { api } from "../shared/routes.ts";

test("works bootstrap distinguishes all works from a non-empty explicit selection", () => {
  assert.equal(api.schedules.bootstrapFromWorks.input.safeParse({}).success, true);
  assert.equal(api.schedules.bootstrapFromWorks.input.safeParse({ workIds: [1] }).success, true);
  assert.equal(api.schedules.bootstrapFromWorks.input.safeParse({ workIds: [] }).success, false);
  assert.equal(
    api.schedules.bootstrapFromWorks.responses[200].safeParse({
      scheduleId: 1,
      created: 2,
      skipped: 3,
      removed: 4,
    }).success,
    true
  );
});

test("works bootstrap scopes selected works to collections of the schedule object", async () => {
  const storage = await readFile("server/storage.ts", "utf8");

  assert.match(storage, /eq\(workCollections\.objectId,\s*schedule\.objectId\)/);
  assert.match(storage, /inArray\(works\.workCollectionId,\s*collectionIds\)/);
  assert.match(storage, /inArray\(works\.id,\s*requestedWorkIds\)/);
  assert.match(storage, /schedule\.sourceType !== "works"/);
});
