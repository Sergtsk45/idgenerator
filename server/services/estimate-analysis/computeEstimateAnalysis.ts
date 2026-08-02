import { createHash } from "node:crypto";

import {
  getEstimatePositionLaborHours,
  getEstimatePositionLaborResources,
  isManHourUnit,
  isMainEstimatePosition,
  normalizeEstimateResourceType,
  parseEstimateNumeric,
} from "@shared/estimateClassification";
import type { Estimate, EstimatePosition, EstimateSection, PositionResource } from "@shared/schema";

export const ESTIMATE_ANALYSIS_VERSION = "2";
export const ESTIMATE_ANALYSIS_SCHEMA_VERSION = 1;

type HydratedPosition = EstimatePosition & { resources: PositionResource[] };
type HydratedSection = EstimateSection & { positions: HydratedPosition[] };

export type HydratedEstimate = {
  estimate: Estimate;
  sections: HydratedSection[];
};

export type EstimateSourceRef = {
  sourceType: "position" | "resource";
  sourceId: number;
  positionId: number;
};

export type EstimateAnalysis = {
  analysisVersion: typeof ESTIMATE_ANALYSIS_VERSION;
  schemaVersion: typeof ESTIMATE_ANALYSIS_SCHEMA_VERSION;
  inputHash: string;
  estimateId: number;
  summary: {
    sectionsCount: number;
    mainWorksCount: number;
    resourceCount: number;
    laborHoursTotal: number;
    laborCoveragePercent: number;
    laborHoursAvailable: boolean;
    materialCandidatesCount: number;
    equipmentCandidatesCount: number;
    rowsWithoutQuantityOrUnitCount: number;
  };
  trace: {
    sectionIds: number[];
    mainWorkPositionIds: number[];
    resourceIds: number[];
    laborResourceIds: number[];
    rowsWithoutQuantityOrUnit: EstimateSourceRef[];
  };
  mainWorks: Array<{
    positionId: number;
    sectionId: number | null;
    lineNo: string;
    code: string | null;
    name: string;
    unit: string | null;
    quantity: number | null;
    laborHours: number;
    laborMachineCost: number;
    laborResourceIds: number[];
  }>;
  materialCandidates: EstimateSourceRef[];
  equipmentCandidates: EstimateSourceRef[];
  unclassifiedResources: Array<
    EstimateSourceRef & {
      resourceType: string | null;
      resourceCode: string | null;
      name: string;
      unit: string | null;
    }
  >;
  warnings: Array<{
    code: "ROW_WITHOUT_QUANTITY_OR_UNIT" | "UNCLASSIFIED_RESOURCE" | "LABOR_DATA_UNAVAILABLE";
    message: string;
    sourceIds: number[];
  }>;
};

const byOrderAndId = (a: { orderIndex: number; id: number }, b: { orderIndex: number; id: number }) =>
  a.orderIndex - b.orderIndex || a.id - b.id;

function planningResourceCategory(resource: PositionResource) {
  const normalized = normalizeEstimateResourceType(resource.resourceType);
  if (normalized === "labor") return isManHourUnit(resource.unit) ? "labor" : "unclassified";
  if (normalized === "unclassified" && resource.resourceType == null && isManHourUnit(resource.unit)) return "labor";
  return normalized;
}

function currentResourceCost(resource: PositionResource): number {
  const total = parseEstimateNumeric(resource.totalCurrentCost);
  if (total !== null && total > 0) return total;
  const quantity = parseEstimateNumeric(resource.quantityTotal ?? resource.quantity);
  const unitCost = parseEstimateNumeric(resource.currentCostPerUnit);
  return quantity !== null && quantity > 0 && unitCost !== null && unitCost > 0 ? quantity * unitCost : 0;
}

function sourceRef(positionId: number, sourceType: "position" | "resource", sourceId: number): EstimateSourceRef {
  return { sourceType, sourceId, positionId };
}

function canonicalInput(input: HydratedEstimate) {
  const sections = [...input.sections].sort(byOrderAndId);
  return {
    analysisVersion: ESTIMATE_ANALYSIS_VERSION,
    schemaVersion: ESTIMATE_ANALYSIS_SCHEMA_VERSION,
    estimate: {
      id: input.estimate.id,
      objectId: input.estimate.objectId,
      code: input.estimate.code,
      name: input.estimate.name,
      objectName: input.estimate.objectName,
      region: input.estimate.region,
      pricingQuarter: input.estimate.pricingQuarter,
      totalCost: parseEstimateNumeric(input.estimate.totalCost),
      totalConstruction: parseEstimateNumeric(input.estimate.totalConstruction),
      totalInstallation: parseEstimateNumeric(input.estimate.totalInstallation),
      totalEquipment: parseEstimateNumeric(input.estimate.totalEquipment),
      totalOther: parseEstimateNumeric(input.estimate.totalOther),
    },
    sections: sections.map((section) => ({
      id: section.id,
      number: section.number,
      title: section.title,
      orderIndex: section.orderIndex,
      positions: [...section.positions].sort(byOrderAndId).map((position) => ({
        id: position.id,
        sectionId: position.sectionId,
        lineNo: position.lineNo,
        code: position.code,
        name: position.name,
        unit: position.unit,
        quantity: parseEstimateNumeric(position.quantity),
        baseCostPerUnit: parseEstimateNumeric(position.baseCostPerUnit),
        indexValue: parseEstimateNumeric(position.indexValue),
        currentCostPerUnit: parseEstimateNumeric(position.currentCostPerUnit),
        totalCurrentCost: parseEstimateNumeric(position.totalCurrentCost),
        notes: position.notes,
        orderIndex: position.orderIndex,
        resources: [...position.resources].sort(byOrderAndId).map((resource) => ({
          id: resource.id,
          resourceCode: resource.resourceCode,
          resourceType: resource.resourceType,
          name: resource.name,
          unit: resource.unit,
          quantity: parseEstimateNumeric(resource.quantity),
          quantityTotal: parseEstimateNumeric(resource.quantityTotal),
          baseCostPerUnit: parseEstimateNumeric(resource.baseCostPerUnit),
          currentCostPerUnit: parseEstimateNumeric(resource.currentCostPerUnit),
          totalCurrentCost: parseEstimateNumeric(resource.totalCurrentCost),
          orderIndex: resource.orderIndex,
        })),
      })),
    })),
  };
}

/** Pure, deterministic analysis of one fully hydrated estimate. */
export function computeEstimateAnalysis(input: HydratedEstimate): EstimateAnalysis {
  const orderedSections = [...input.sections].sort(byOrderAndId);
  const positions = orderedSections.flatMap((section) => [...section.positions].sort(byOrderAndId));
  const resources = positions.flatMap((position) => [...position.resources].sort(byOrderAndId));
  const mainPositions = positions.filter(isMainEstimatePosition);
  const mainPositionIds = new Set(mainPositions.map((position) => position.id));

  const mainWorks = mainPositions.map((position) => {
    const laborResources = getEstimatePositionLaborResources(position.resources);
    const laborMachineCost = position.resources
      .filter((resource) => ["labor", "equipment"].includes(planningResourceCategory(resource)))
      .reduce((sum, resource) => sum + currentResourceCost(resource), 0);
    return {
      positionId: position.id,
      sectionId: position.sectionId,
      lineNo: position.lineNo,
      code: position.code,
      name: position.name,
      unit: position.unit,
      quantity: parseEstimateNumeric(position.quantity),
      laborHours: getEstimatePositionLaborHours(position.resources) ?? 0,
      laborMachineCost,
      laborResourceIds: laborResources
        .filter((resource) => (parseEstimateNumeric(resource.quantityTotal ?? resource.quantity) ?? 0) > 0)
        .map((resource) => resource.id)
        .sort((a, b) => a - b),
    };
  });
  const coveredWorks = mainWorks.filter((work) => work.laborHours > 0);
  const laborHoursTotal = mainWorks.reduce((sum, work) => sum + work.laborHours, 0);
  const laborCoveragePercent = mainWorks.length === 0 ? 0 : Math.round((coveredWorks.length / mainWorks.length) * 10_000) / 100;

  // Existing estimate behavior treats non-main rows as material/sub-item candidates.
  const materialCandidates: EstimateSourceRef[] = positions
    .filter((position) => !mainPositionIds.has(position.id))
    .map((position) => sourceRef(position.id, "position", position.id));
  const equipmentCandidates: EstimateSourceRef[] = [];
  const unclassifiedResources: EstimateAnalysis["unclassifiedResources"] = [];

  for (const position of positions) {
    for (const resource of [...position.resources].sort(byOrderAndId)) {
      const classification = planningResourceCategory(resource);
      const ref = sourceRef(position.id, "resource", resource.id);
      if (classification === "material") materialCandidates.push(ref);
      if (classification === "equipment") equipmentCandidates.push(ref);
      if (classification === "unclassified") {
        unclassifiedResources.push({
          ...ref,
          resourceType: resource.resourceType,
          resourceCode: resource.resourceCode,
          name: resource.name,
          unit: resource.unit,
        });
      }
    }
  }

  const rowsWithoutQuantityOrUnit: EstimateSourceRef[] = [];
  for (const position of positions) {
    if (parseEstimateNumeric(position.quantity) === null || !position.unit?.trim()) {
      rowsWithoutQuantityOrUnit.push(sourceRef(position.id, "position", position.id));
    }
    for (const resource of [...position.resources].sort(byOrderAndId)) {
      if (parseEstimateNumeric(resource.quantityTotal ?? resource.quantity) === null || !resource.unit?.trim()) {
        rowsWithoutQuantityOrUnit.push(sourceRef(position.id, "resource", resource.id));
      }
    }
  }

  const warnings: EstimateAnalysis["warnings"] = [];
  if (rowsWithoutQuantityOrUnit.length) {
    warnings.push({
      code: "ROW_WITHOUT_QUANTITY_OR_UNIT",
      message: "Some estimate rows have no quantity or unit",
      sourceIds: rowsWithoutQuantityOrUnit.map((ref) => ref.sourceId),
    });
  }
  if (unclassifiedResources.length) {
    warnings.push({
      code: "UNCLASSIFIED_RESOURCE",
      message: "Some resources have an unsupported resource type",
      sourceIds: unclassifiedResources.map((ref) => ref.sourceId),
    });
  }
  if (coveredWorks.length === 0) {
    warnings.push({
      code: "LABOR_DATA_UNAVAILABLE",
      message: "No supported labor hours were found for main works",
      sourceIds: mainWorks.map((work) => work.positionId),
    });
  }

  const laborResourceIds = mainWorks.flatMap((work) => work.laborResourceIds);
  return {
    analysisVersion: ESTIMATE_ANALYSIS_VERSION,
    schemaVersion: ESTIMATE_ANALYSIS_SCHEMA_VERSION,
    inputHash: createHash("sha256").update(JSON.stringify(canonicalInput(input))).digest("hex"),
    estimateId: input.estimate.id,
    summary: {
      sectionsCount: orderedSections.length,
      mainWorksCount: mainWorks.length,
      resourceCount: resources.length,
      laborHoursTotal,
      laborCoveragePercent,
      laborHoursAvailable: coveredWorks.length > 0,
      materialCandidatesCount: materialCandidates.length,
      equipmentCandidatesCount: equipmentCandidates.length,
      rowsWithoutQuantityOrUnitCount: rowsWithoutQuantityOrUnit.length,
    },
    trace: {
      sectionIds: orderedSections.map((section) => section.id),
      mainWorkPositionIds: mainWorks.map((work) => work.positionId),
      resourceIds: resources.map((resource) => resource.id),
      laborResourceIds,
      rowsWithoutQuantityOrUnit,
    },
    mainWorks,
    materialCandidates,
    equipmentCandidates,
    unclassifiedResources,
    warnings,
  };
}
