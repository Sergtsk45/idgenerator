import test from "node:test";
import assert from "node:assert/strict";

import {
  computeEstimateAnalysis,
  type HydratedEstimate,
} from "../server/services/estimate-analysis/computeEstimateAnalysis.ts";

const estimateDefaults = {
  objectId: 7,
  code: "ЛСР-1",
  name: "Test estimate",
  objectName: null,
  region: null,
  pricingQuarter: null,
  totalCost: null,
  totalConstruction: null,
  totalInstallation: null,
  totalEquipment: null,
  totalOther: null,
  createdAt: null,
};

const positionDefaults = {
  estimateId: 101,
  baseCostPerUnit: null,
  indexValue: null,
  currentCostPerUnit: null,
  totalCurrentCost: null,
  notes: null,
};

const resourceDefaults = {
  resourceCode: null,
  baseCostPerUnit: null,
  currentCostPerUnit: null,
  totalCurrentCost: null,
};

function laborFixture(): HydratedEstimate {
  return {
    estimate: { id: 101, ...estimateDefaults },
    sections: [
      {
        id: 12,
        estimateId: 101,
        number: "2",
        title: "Finishing",
        orderIndex: 2,
        positions: [
          {
            id: 104,
            ...positionDefaults,
            sectionId: 12,
            lineNo: "4",
            code: "ТЕР15-01-001",
            name: "Finish walls",
            unit: null,
            quantity: "2.0000",
            orderIndex: 4,
            resources: [
              {
                id: 1005,
                ...resourceDefaults,
                positionId: 104,
                resourceType: "XYZ",
                name: "Unknown explicit type",
                unit: "чел.-ч",
                quantity: null,
                quantityTotal: "99.0000",
                orderIndex: 5,
              },
            ],
          },
        ],
      },
      {
        id: 11,
        estimateId: 101,
        number: "1",
        title: "Earthworks",
        orderIndex: 1,
        positions: [
          {
            id: 103,
            ...positionDefaults,
            sectionId: 11,
            lineNo: "3",
            code: "ФЕР01-02-003",
            name: "Backfill",
            unit: "м3",
            quantity: null,
            orderIndex: 3,
            resources: [
              {
                id: 1004,
                ...resourceDefaults,
                positionId: 103,
                resourceType: "ЭМ",
                name: "Excavator",
                unit: "маш.-ч",
                quantity: null,
                quantityTotal: "2.0000",
                orderIndex: 4,
              },
              {
                id: 1003,
                ...resourceDefaults,
                positionId: 103,
                resourceType: "ОТМ",
                name: "Machine operator labor",
                unit: "чел.-ч",
                quantity: "4.0000",
                quantityTotal: null,
                orderIndex: 3,
              },
            ],
          },
          {
            id: 102,
            ...positionDefaults,
            sectionId: 11,
            lineNo: "2.1",
            code: "ФСБЦ01-001",
            name: "Auxiliary material row",
            unit: "т",
            quantity: "5.0000",
            orderIndex: 2,
            resources: [],
          },
          {
            id: 101,
            ...positionDefaults,
            sectionId: 11,
            lineNo: "1",
            code: "ГЭСН01-01-001-01",
            name: "Excavate soil",
            unit: "м3",
            quantity: "10.0000",
            orderIndex: 1,
            resources: [
              {
                id: 1002,
                ...resourceDefaults,
                positionId: 101,
                resourceType: "М",
                name: "Sand",
                unit: "м3",
                quantity: null,
                quantityTotal: "5.0000",
                orderIndex: 2,
              },
              {
                id: 1001,
                ...resourceDefaults,
                positionId: 101,
                resourceType: " (от) ",
                name: "Worker labor",
                unit: "чел.-ч",
                quantity: "1.0000",
                quantityTotal: "8.0000",
                orderIndex: 1,
              },
            ],
          },
        ],
      },
    ],
  };
}

test("estimate analysis is deterministic, traceable and calculates labor coverage", () => {
  const fixture = laborFixture();
  const first = computeEstimateAnalysis(fixture);
  const second = computeEstimateAnalysis(fixture);

  assert.deepEqual(second, first);
  assert.equal(first.analysisVersion, "1");
  assert.equal(first.schemaVersion, 1);
  assert.match(first.inputHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(first.summary, {
    sectionsCount: 2,
    mainWorksCount: 3,
    resourceCount: 5,
    laborHoursTotal: 12,
    laborCoveragePercent: 66.67,
    laborHoursAvailable: true,
    materialCandidatesCount: 2,
    equipmentCandidatesCount: 1,
    rowsWithoutQuantityOrUnitCount: 2,
  });
  assert.deepEqual(first.trace.sectionIds, [11, 12]);
  assert.deepEqual(first.trace.mainWorkPositionIds, [101, 103, 104]);
  assert.deepEqual(first.trace.laborResourceIds, [1001, 1003]);
  assert.deepEqual(first.materialCandidates, [
    { sourceType: "position", sourceId: 102, positionId: 102 },
    { sourceType: "resource", sourceId: 1002, positionId: 101 },
  ]);
  assert.deepEqual(first.equipmentCandidates, [
    { sourceType: "resource", sourceId: 1004, positionId: 103 },
  ]);
  assert.deepEqual(first.unclassifiedResources.map((resource) => resource.sourceId), [1005]);
  assert.equal(first.mainWorks.find((work) => work.positionId === 104)?.laborHours, 0);
});

test("analysis canonicalizes row order and invalidates its hash when source data changes", () => {
  const original = laborFixture();
  const reordered = structuredClone(original);
  reordered.sections.reverse();
  for (const section of reordered.sections) {
    section.positions.reverse();
    for (const position of section.positions) position.resources.reverse();
  }
  assert.deepEqual(computeEstimateAnalysis(reordered), computeEstimateAnalysis(original));

  const changed = structuredClone(original);
  const laborResource = changed.sections
    .flatMap((section) => section.positions)
    .flatMap((position) => position.resources)
    .find((resource) => resource.id === 1001)!;
  laborResource.quantityTotal = "9.0000";

  const before = computeEstimateAnalysis(original);
  const after = computeEstimateAnalysis(changed);
  assert.notEqual(after.inputHash, before.inputHash);
  assert.equal(after.summary.laborHoursTotal, 13);
});

test("estimate without supported labor reports zero coverage and a warning", () => {
  const fixture: HydratedEstimate = {
    estimate: { id: 201, ...estimateDefaults },
    sections: [
      {
        id: 21,
        estimateId: 201,
        number: "1",
        title: "No labor",
        orderIndex: 1,
        positions: [
          {
            id: 201,
            ...positionDefaults,
            estimateId: 201,
            sectionId: 21,
            lineNo: "1",
            code: "ГЭСН01-01-001",
            name: "Work without resources",
            unit: "м2",
            quantity: "1.0000",
            orderIndex: 1,
            resources: [],
          },
        ],
      },
    ],
  };

  const result = computeEstimateAnalysis(fixture);
  assert.equal(result.summary.laborHoursTotal, 0);
  assert.equal(result.summary.laborCoveragePercent, 0);
  assert.equal(result.summary.laborHoursAvailable, false);
  assert.deepEqual(result.trace.laborResourceIds, []);
  assert.ok(result.warnings.some((warning) => warning.code === "LABOR_DATA_UNAVAILABLE"));
});
