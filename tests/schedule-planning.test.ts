import assert from "node:assert/strict";
import test from "node:test";

import {
  CREW_LABOR_COVERAGE_THRESHOLD_PERCENT,
  SchedulePlanningError,
  addWorkingDays,
  isWorkingDay,
  nextWorkingDay,
  planSchedule,
  type PlanScheduleInput,
} from "../server/services/schedule-planning/planSchedule";

const works = [
  { positionId: 11, name: "First", laborHours: 10, quantity: 1 },
  { positionId: 12, name: "Second", laborHours: 20, quantity: 2 },
  { positionId: 13, name: "Third", laborHours: 30, quantity: 3 },
];

function targetInput(overrides: Partial<PlanScheduleInput> = {}): PlanScheduleInput {
  return {
    projectStartDate: "2026-08-03",
    workingCalendar: "5x2",
    planningMode: "target_duration",
    targetDurationDays: 12,
    laborCoveragePercent: 100,
    mainWorks: works,
    ...overrides,
  };
}

test("5x2 and 6x1 calendars skip their non-working days in UTC", () => {
  assert.equal(isWorkingDay("2026-08-08", "5x2"), false);
  assert.equal(isWorkingDay("2026-08-08", "6x1"), true);
  assert.equal(isWorkingDay("2026-08-09", "6x1"), false);
  assert.equal(nextWorkingDay("2026-08-07", "5x2"), "2026-08-10");
  assert.equal(nextWorkingDay("2026-08-08", "6x1"), "2026-08-10");
  assert.equal(addWorkingDays("2026-08-07", 2, "5x2"), "2026-08-10");
  assert.equal(addWorkingDays("2026-08-07", 2, "6x1"), "2026-08-08");
});

test("target duration uses stable Hamilton allocation and exact total", () => {
  const result = planSchedule(targetInput());

  assert.deepEqual(result.tasks.map((task) => task.durationDays), [3, 4, 5]);
  assert.equal(result.totalWorkingDays, 12);
  assert.deepEqual(result.tasks.map((task) => [task.startDate, task.endDate]), [
    ["2026-08-03", "2026-08-05"],
    ["2026-08-06", "2026-08-11"],
    ["2026-08-12", "2026-08-18"],
  ]);
  assert.deepEqual(result.tasks.map((task) => task.estimatePositionId), [11, 12, 13]);
});

test("Hamilton ties are resolved by estimate order", () => {
  const result = planSchedule(targetInput({
    targetDurationDays: 5,
    mainWorks: works.map((work) => ({ ...work, laborHours: 1 })),
  }));
  assert.deepEqual(result.tasks.map((task) => task.durationDays), [2, 2, 1]);
});

test("target shorter than work count keeps one day per work and reports rounding warning", () => {
  const result = planSchedule(targetInput({ targetDurationDays: 2 }));
  assert.deepEqual(result.tasks.map((task) => task.durationDays), [1, 1, 1]);
  assert.equal(result.totalWorkingDays, 3);
  assert.equal(result.warnings[0].code, "TARGET_DURATION_BELOW_MINIMUM");
});

test("weight fallback hierarchy is explicit in tasks, warnings and confidence", () => {
  const result = planSchedule(targetInput({
    targetDurationDays: 8,
    mainWorks: [
      { positionId: 1, name: "Labor", laborHours: 4 },
      { positionId: 2, name: "Cost", laborHours: 0, laborMachineCost: 3 },
      { positionId: 3, name: "Quantity", laborHours: 0, quantity: 2 },
      { positionId: 4, name: "Equal", laborHours: 0 },
    ],
  }));

  assert.deepEqual(result.tasks.map((task) => task.weightSource), [
    "labor_hours",
    "labor_machine_cost",
    "quantity",
    "equal",
  ]);
  assert.equal(result.confidence, "low");
  assert.deepEqual(result.warnings.map((warning) => warning.code), [
    "WEIGHT_FALLBACK_LABOR_MACHINE_COST",
    "WEIGHT_FALLBACK_QUANTITY",
    "WEIGHT_FALLBACK_EQUAL",
  ]);
});

test("crew-size mode uses the formal capacity formula", () => {
  const result = planSchedule({
    projectStartDate: "2026-08-03",
    workingCalendar: "6x1",
    planningMode: "crew_size",
    crewSize: 2,
    shiftHours: 8,
    utilizationFactor: 0.5,
    laborCoveragePercent: CREW_LABOR_COVERAGE_THRESHOLD_PERCENT,
    mainWorks: [
      { positionId: 1, name: "Short", laborHours: 1 },
      { positionId: 2, name: "Long", laborHours: 17 },
    ],
  });

  assert.deepEqual(result.tasks.map((task) => task.durationDays), [1, 3]);
  assert.equal(result.calendarEnd, "2026-08-06");
  assert.equal(result.confidence, "high");
});

test("crew-size mode rejects partial coverage and uncovered positions", () => {
  assert.throws(
    () => planSchedule({
      projectStartDate: "2026-08-03",
      workingCalendar: "5x2",
      planningMode: "crew_size",
      crewSize: 2,
      shiftHours: 8,
      utilizationFactor: 0.85,
      laborCoveragePercent: 99.99,
      mainWorks: works,
    }),
    (error) => error instanceof SchedulePlanningError && error.code === "LABOR_DATA_REQUIRED",
  );
  assert.throws(
    () => planSchedule({
      projectStartDate: "2026-08-03",
      workingCalendar: "5x2",
      planningMode: "crew_size",
      crewSize: 2,
      shiftHours: 8,
      utilizationFactor: 0.85,
      laborCoveragePercent: 100,
      mainWorks: [{ positionId: 1, name: "Missing", laborHours: 0 }],
    }),
    (error) => error instanceof SchedulePlanningError && error.code === "LABOR_DATA_REQUIRED",
  );
});

test("a weekend start rolls forward and is disclosed", () => {
  const result = planSchedule(targetInput({ projectStartDate: "2026-08-08", targetDurationDays: 3 }));
  assert.equal(result.calendarStart, "2026-08-10");
  assert.equal(result.warnings[0].code, "START_DATE_ADJUSTED");
});

test("property-style invariants hold across target sizes and both calendars", () => {
  for (const workingCalendar of ["5x2", "6x1"] as const) {
    for (let targetDurationDays = 1; targetDurationDays <= 50; targetDurationDays++) {
      const result = planSchedule(targetInput({ workingCalendar, targetDurationDays }));
      assert.ok(result.tasks.every((task) => task.durationDays >= 1));
      assert.ok(result.tasks.every((task) => task.startDate <= task.endDate));
      assert.ok(result.tasks.every((task) => isWorkingDay(task.startDate, workingCalendar)));
      assert.ok(result.tasks.every((task) => isWorkingDay(task.endDate, workingCalendar)));
      for (let index = 1; index < result.tasks.length; index++) {
        assert.ok(result.tasks[index - 1].endDate < result.tasks[index].startDate);
      }
      assert.equal(result.totalWorkingDays, Math.max(targetDurationDays, works.length));
    }
  }
});
