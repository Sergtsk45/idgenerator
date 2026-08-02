import assert from "node:assert/strict";
import test from "node:test";

import type { ScheduleTask } from "../shared/schema";
import { aggregateActSchemes, groupActTasks, mergeActFreeText } from "../server/services/acts/actGenerationCore";

function task(input: Partial<ScheduleTask> & Pick<ScheduleTask, "id" | "actNumber">): ScheduleTask {
  return {
    scheduleId: 1,
    workId: 1,
    estimatePositionId: null,
    actTemplateId: null,
    projectDrawings: null,
    normativeRefs: null,
    executiveSchemes: null,
    titleOverride: null,
    quantity: null,
    unit: null,
    splitGroupId: null,
    splitIndex: null,
    independentMaterials: false,
    startDate: "2026-08-02",
    durationDays: 1,
    orderIndex: 0,
    createdAt: new Date(),
    ...input,
  };
}

test("act generation core groups deterministically and keeps distinct scheme files", () => {
  const tasks = [
    task({ id: 1, actNumber: 2, executiveSchemes: [{ title: "Схема", fileUrl: "/a.pdf" }] }),
    task({ id: 2, actNumber: null }),
    task({ id: 3, actNumber: 2, executiveSchemes: [
      { title: "схема", fileUrl: "/a.pdf" },
      { title: "Схема", fileUrl: "/b.pdf" },
    ] }),
  ];
  const grouped = groupActTasks(tasks);
  assert.equal(grouped.invalidTaskId, null);
  assert.equal(grouped.skippedNoActNumber, 1);
  assert.deepEqual(grouped.groups.get(2)?.map(({ id }) => id), [1, 3]);
  assert.deepEqual(aggregateActSchemes(grouped.groups.get(2)!), [
    { title: "Схема", fileUrl: "/a.pdf" },
    { title: "Схема", fileUrl: "/b.pdf" },
  ]);
  assert.equal(mergeActFreeText(["РД-1, ГОСТ", "рд-1\nСП"]), "РД-1, ГОСТ, СП");
});

test("act generation core reports an invalid numbered task", () => {
  const grouped = groupActTasks([task({ id: 9, actNumber: 0 })]);
  assert.equal(grouped.invalidTaskId, 9);
});
