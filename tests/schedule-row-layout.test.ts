import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildScheduleRowLayout } from "../client/src/lib/schedule-row-layout.ts";

test("layout uses only visible tasks and includes expanded auxiliary rows", () => {
  const layout = buildScheduleRowLayout(
    [
      { id: 2, auxiliaryCount: 2 },
      { id: 4, auxiliaryCount: 0 },
    ],
    88,
    32
  );

  assert.equal(layout.taskTopPixelByTaskId.get(2), 0);
  assert.equal(layout.taskTopPixelByTaskId.get(4), 152);
  assert.equal(layout.taskTopPixelByTaskId.has(1), false);
  assert.equal(layout.totalHeight, 240);
});

test("Schedule builds timeline layout from the same filtered tasks it renders", async () => {
  const source = await readFile("client/src/pages/Schedule.tsx", "utf8");

  assert.match(source, /const rows = filteredTasks\.map\(\(task\) =>/);
});

test("Schedule keeps the date header visible inside the Gantt scroller", async () => {
  const source = await readFile("client/src/pages/Schedule.tsx", "utf8");

  assert.match(source, /sticky top-0 z-20 w-max min-w-full bg-background border-b/);
});
