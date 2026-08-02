import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateMissingWorkflowInputs,
  validateAndNormalizeWorkflowInput,
  type WorkflowInputKey,
} from "../server/services/execution-workflow/workflowInputs.ts";
import { MCP_ERROR_CODES, McpToolError } from "../server/mcp/errors.ts";

const input = (key: WorkflowInputKey, valueJson: unknown, confirmed = true) => ({ key, valueJson, confirmed });
const keys = (result: ReturnType<typeof evaluateMissingWorkflowInputs>) => result.questions.map((q) => q.key);
const common = [
  input("projectStartDate", "2026-09-01"),
  input("workingCalendar", "5x2"),
];

test("missing-input rules ask common questions first and defer conditional questions", () => {
  const result = evaluateMissingWorkflowInputs([], { analysisAvailable: true, laborHoursAvailable: true });
  assert.deepEqual(keys(result), ["projectStartDate", "workingCalendar", "planningMode"]);
  assert.equal(result.ready, false);
  assert.equal(result.questions[1]?.type, "single_select");
  assert.deepEqual(result.questions[1]?.options, ["5x2", "6x1"]);
  assert.ok(result.questions.every((question) => question.reason && question.validation.required));
});

test("target-duration mode asks only for a positive integer target", () => {
  const incomplete = evaluateMissingWorkflowInputs(
    [...common, input("planningMode", "target_duration")],
    { analysisAvailable: true, laborHoursAvailable: false },
  );
  assert.deepEqual(keys(incomplete), ["targetDurationDays"]);
  assert.deepEqual(incomplete.blockingIssues, []);

  const ready = evaluateMissingWorkflowInputs(
    [...common, input("planningMode", "target_duration"), input("targetDurationDays", 20)],
    { analysisAvailable: true, laborHoursAvailable: false },
  );
  assert.equal(ready.ready, true);
  assert.deepEqual(keys(ready), []);
});

test("crew-size mode with labor asks crew inputs and exposes confirmable defaults", () => {
  const result = evaluateMissingWorkflowInputs(
    [...common, input("planningMode", "crew_size")],
    { analysisAvailable: true, laborHoursAvailable: true },
  );
  assert.deepEqual(keys(result), ["crewSize", "shiftHours", "utilizationFactor"]);
  assert.equal(result.questions.find((q) => q.key === "shiftHours")?.defaultValue, 8);
  assert.equal(result.questions.find((q) => q.key === "utilizationFactor")?.defaultValue, 0.85);
});

test("crew-size mode without labor blocks and suggests target-duration mode", () => {
  const result = evaluateMissingWorkflowInputs(
    [...common, input("planningMode", "crew_size")],
    { analysisAvailable: true, laborHoursAvailable: false },
  );
  assert.deepEqual(keys(result), []);
  assert.deepEqual(result.blockingIssues, [{
    code: "LABOR_DATA_REQUIRED",
    blocking: true,
    reason: "В смете нет пригодной трудоёмкости для расчёта по численности бригады.",
    suggestedInput: { key: "planningMode", value: "target_duration" },
  }]);
  assert.equal(result.ready, false);
});

test("unconfirmed defaults and invalid confirmed values remain questions", () => {
  const result = evaluateMissingWorkflowInputs([
    ...common,
    input("planningMode", "crew_size"),
    input("crewSize", -2),
    input("shiftHours", 8, false),
    input("utilizationFactor", 0.85, false),
  ], { analysisAvailable: true, laborHoursAvailable: true });
  assert.deepEqual(keys(result), ["crewSize", "shiftHours", "utilizationFactor"]);
});

test("crew-size mode is ready only after valid explicit confirmation", () => {
  const result = evaluateMissingWorkflowInputs([
    ...common,
    input("planningMode", "crew_size"),
    input("crewSize", 4),
    input("shiftHours", 8),
    input("utilizationFactor", 0.85),
  ], { analysisAvailable: true, laborHoursAvailable: true });
  assert.equal(result.ready, true);
  assert.deepEqual(result.questions, []);
  assert.deepEqual(result.blockingIssues, []);
});

test("validation rejects unknown keys, impossible dates and invalid numeric boundaries", () => {
  const invalid: Array<[string, unknown]> = [
    ["unknown", 1],
    ["projectStartDate", "2026-02-30"],
    ["projectStartDate", "01.09.2026"],
    ["workingCalendar", "7x0"],
    ["targetDurationDays", 1.5],
    ["crewSize", 0],
    ["crewSize", -1],
    ["shiftHours", 0],
    ["shiftHours", 25],
    ["utilizationFactor", 0],
    ["utilizationFactor", 1.01],
  ];
  for (const [key, value] of invalid) {
    assert.throws(
      () => validateAndNormalizeWorkflowInput(key, value),
      (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.VALIDATION_ERROR,
      `${key}=${String(value)} must be rejected`,
    );
  }
  assert.deepEqual(validateAndNormalizeWorkflowInput("projectStartDate", "2024-02-29"), {
    key: "projectStartDate",
    value: "2024-02-29",
  });
});

test("schedule input hash is deterministic, relevant and analysis-aware", () => {
  const context = { analysisAvailable: true, laborHoursAvailable: false, analysisInputHash: "analysis-a" };
  const rows = [...common, input("planningMode", "target_duration"), input("targetDurationDays", 20)];
  const first = evaluateMissingWorkflowInputs(rows, context).scheduleInputHash;
  const reordered = evaluateMissingWorkflowInputs([...rows].reverse(), context).scheduleInputHash;
  assert.equal(first, reordered);
  assert.match(first, /^[a-f0-9]{64}$/);

  const withIrrelevantCrew = evaluateMissingWorkflowInputs([...rows, input("crewSize", 99)], context).scheduleInputHash;
  assert.equal(first, withIrrelevantCrew);
  assert.notEqual(first, evaluateMissingWorkflowInputs([
    input("projectStartDate", "2026-09-02"), ...rows.slice(1),
  ], context).scheduleInputHash);
  assert.notEqual(first, evaluateMissingWorkflowInputs(rows, { ...context, analysisInputHash: "analysis-b" }).scheduleInputHash);
});

test("analysis must be explicitly available before either planning mode is ready", () => {
  const target = evaluateMissingWorkflowInputs(
    [...common, input("planningMode", "target_duration"), input("targetDurationDays", 20)],
  );
  const crew = evaluateMissingWorkflowInputs([
    ...common,
    input("planningMode", "crew_size"),
    input("crewSize", 4),
    input("shiftHours", 8),
    input("utilizationFactor", 0.85),
  ]);
  assert.equal(target.ready, false);
  assert.equal(crew.ready, false);
});
