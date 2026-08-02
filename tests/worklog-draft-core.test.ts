import assert from "node:assert/strict";
import test from "node:test";

import { buildWorklogDraft } from "../server/services/worklog/worklogDraftCore.ts";

test("worklog keeps reported facts and replaces matching plans only with generated act evidence", () => {
  const input = {
    scheduleTasks: [
      { id: 1, date: "2026-08-01", description: "Plan A", quantity: 1, unit: "m", sourceType: "estimate" as const, sourceId: 10 },
      { id: 2, date: "2026-08-02", description: "Plan B", quantity: 2, unit: "m", sourceType: "estimate" as const, sourceId: 20 },
    ],
    messages: [{ id: 3, date: "2026-08-02", description: "Reported B", quantity: 1, unit: "m" }],
    acts: [{ id: 4, date: "2026-08-03", status: "generated", works: [
      { sourceType: "estimate" as const, sourceId: 10, description: "Confirmed A", quantity: 1, unit: "m" },
    ] }],
    ignoredMessages: 1,
  };
  const first = buildWorklogDraft(input);
  const second = buildWorklogDraft(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first.entries.map((entry) => entry.evidenceStatus), ["planned", "planned", "reported", "act_confirmed"]);
  assert.equal(first.entries.some((entry) => entry.description === "Plan A"), true);
  assert.match(first.warnings[0], /not treated as factual/);
});
