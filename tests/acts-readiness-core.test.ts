import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_ACT_SOURCE_FIELDS,
  evaluateActsReadiness,
  type ActReadinessTaskInput,
  type RequiredActSourceField,
} from "../server/services/acts/actsReadinessCore";

function sourceFields(value: boolean): Record<RequiredActSourceField, boolean> {
  return Object.fromEntries(REQUIRED_ACT_SOURCE_FIELDS.map((field) => [field, value])) as Record<
    RequiredActSourceField,
    boolean
  >;
}

function readyTask(overrides: Partial<ActReadinessTaskInput> = {}): ActReadinessTaskInput {
  return {
    id: 1,
    actNumber: 1,
    actTemplateId: 10,
    startDate: "2026-08-02",
    durationDays: 1,
    workId: null,
    estimatePositionId: 100,
    projectDrawings: "РД-1",
    normativeRefs: "СП 1",
    executiveSchemes: [{ title: "ИС-1" }],
    hasMaterials: true,
    ...overrides,
  };
}

test("acts readiness is deterministic and scopes blockers to affected groups", () => {
  const ready = evaluateActsReadiness({
    scheduleId: 7,
    tasks: [readyTask()],
    missingQualityRequirements: [],
    materialClassificationIssues: [],
    sourceData: { objectId: 5, fields: sourceFields(true) },
  });
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.groups, [{ actNumber: 1, taskIds: [1], ready: true, blockingIssues: [] }]);

  const fields = sourceFields(true);
  fields["parties.builder.fullName"] = false;
  const blocked = evaluateActsReadiness({
    scheduleId: 7,
    tasks: [
      readyTask({
        id: 1,
        actNumber: 1,
        actTemplateId: null,
        startDate: "2026-02-30",
        durationDays: 0,
        estimatePositionId: null,
        projectDrawings: " ",
        normativeRefs: null,
        executiveSchemes: [],
        hasMaterials: false,
      }),
      readyTask({ id: 2, actNumber: 2, actTemplateId: 20 }),
      readyTask({ id: 3, actNumber: null }),
      readyTask({ id: 4, actNumber: 3, actTemplateId: 30 }),
      readyTask({ id: 5, actNumber: 3, actTemplateId: 31 }),
    ],
    missingQualityRequirements: [{
      projectMaterialId: 90,
      ruleId: "mvp-equipment-passport-v1",
      reason: "Для оборудования нужен паспорт.",
      acceptableDocTypes: ["passport"],
      usedInTaskIds: [1],
    }],
    materialClassificationIssues: [],
    sourceData: { objectId: 5, fields },
  });

  assert.equal(blocked.ready, false);
  assert.deepEqual(blocked.groups.map((group) => group.actNumber), [1, 2, 3]);
  assert.deepEqual(
    blocked.groups[0].blockingIssues.map((issue) => issue.code),
    [
      "ACT_DATE_INVALID",
      "ACT_WORK_MISSING",
      "ACT_MATERIAL_MISSING",
      "ACT_TEMPLATE_MISSING",
      "PROJECT_DOCUMENTATION_MISSING",
      "NORMATIVE_REFERENCE_MISSING",
      "EXECUTIVE_SCHEME_MISSING",
      "QUALITY_DOCUMENT_MISSING",
    ],
  );
  assert.equal(blocked.groups[1].ready, true);
  assert.deepEqual(blocked.groups[1].blockingIssues, []);
  assert.deepEqual(blocked.groups[2].blockingIssues.map((issue) => issue.code), ["ACT_TEMPLATE_CONFLICT"]);
  assert.deepEqual(blocked.unassignedIssues.map((issue) => issue.code), ["ACT_NUMBER_MISSING"]);
  assert.deepEqual(blocked.globalIssues.map((issue) => issue.details?.fieldPath), ["parties.builder.fullName"]);
});
