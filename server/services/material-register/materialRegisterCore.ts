import { normalizeEstimateResourceType, parseEstimateNumeric } from "@shared/estimateClassification";

export const MATERIAL_REGISTER_RULES_VERSION = 1;
export const RULES_VERSION = MATERIAL_REGISTER_RULES_VERSION;

export const MATERIAL_CATEGORIES = ["material", "equipment", "product", "unclassified"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];
export type MaterialClassificationMethod = "resource_type" | "rule" | "manual" | "unclassified";
export type MaterialClassificationConfidence = "high" | "medium" | "low";
export type QualityDocumentType = "certificate" | "declaration" | "passport";

export interface MaterialClassification {
  category: MaterialCategory;
  method: MaterialClassificationMethod;
  confidence: MaterialClassificationConfidence;
  confirmed: boolean;
  ruleId: string | null;
  reason: string;
}

export interface MaterialRegisterSourceInput {
  sourceType: "resource" | "position";
  sourceId: number;
  estimateId: number;
  estimatePositionId: number;
  resourceType?: string | null;
  resourceCode?: string | null;
  name: string;
  unit?: string | null;
  quantity?: unknown;
  /** Persisted service-level overrides are applied before dedup and always win. */
  manualClassification?: MaterialCategory | null;
}

export interface MaterialRegisterSource extends MaterialRegisterSourceInput {
  sourceName: string;
  sourceUnit: string | null;
  normalizedName: string;
  normalizedUnit: string | null;
  normalizedQuantity: number | null;
  classification: MaterialClassification;
}

export interface MaterialRequirementRule {
  ruleId: string;
  category: Exclude<MaterialCategory, "unclassified">;
  acceptableDocTypes: readonly QualityDocumentType[];
  match: "any";
  reason: string;
  priority: number;
}

export const MATERIAL_REQUIREMENT_RULES: readonly MaterialRequirementRule[] = [
  {
    ruleId: "mvp-material-quality-document-v1",
    category: "material",
    acceptableDocTypes: ["certificate", "declaration", "passport"],
    match: "any",
    reason: "MVP rule: a material needs one bound certificate, declaration, or quality passport; normative sufficiency is not asserted",
    priority: 100,
  },
  {
    ruleId: "mvp-equipment-passport-v1",
    category: "equipment",
    acceptableDocTypes: ["passport"],
    match: "any",
    reason: "MVP rule: equipment needs a bound passport; normative sufficiency is not asserted",
    priority: 100,
  },
  {
    ruleId: "mvp-product-quality-document-v1",
    category: "product",
    acceptableDocTypes: ["certificate", "passport"],
    match: "any",
    reason: "MVP rule: a construction product needs one bound certificate or passport; normative sufficiency is not asserted",
    priority: 100,
  },
] as const;

export interface MaterialRegisterItem {
  dedupKey: string;
  displayName: string;
  normalizedName: string;
  displayUnit: string | null;
  normalizedUnit: string | null;
  classification: MaterialClassification;
  quantity: number | null;
  sourceIds: Array<{ sourceType: "resource" | "position"; sourceId: number }>;
  estimatePositionIds: number[];
  sources: MaterialRegisterSource[];
  requirements: MaterialRequirementRule[];
}

export interface MaterialRegisterBlockingIssue {
  code: "MATERIAL_CLASSIFICATION_REQUIRED";
  blocking: true;
  dedupKey: string;
  sourceIds: Array<{ sourceType: "resource" | "position"; sourceId: number }>;
  reason: string;
}

export interface MaterialRegisterDraft {
  rulesVersion: typeof MATERIAL_REGISTER_RULES_VERSION;
  items: MaterialRegisterItem[];
  blockingIssues: MaterialRegisterBlockingIssue[];
  ready: boolean;
}

function displayText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

/** Conservative key normalization: model numbers and punctuation remain significant. */
export function normalizeMaterialName(value: string): string {
  return displayText(value).toLocaleLowerCase("ru-RU");
}

const UNIT_ALIASES: Readonly<Record<string, string>> = {
  "шт.": "шт",
  "кг.": "кг",
  "т.": "т",
  "л.": "л",
  "компл.": "компл",
  "м2": "м²",
  "м^2": "м²",
  "м3": "м³",
  "м^3": "м³",
};

export function normalizeMaterialUnit(value: string | null | undefined): string | null {
  const normalized = value == null ? "" : displayText(value).toLocaleLowerCase("ru-RU");
  if (!normalized) return null;
  return UNIT_ALIASES[normalized] ?? normalized;
}

function classification(
  category: MaterialCategory,
  method: MaterialClassificationMethod,
  confidence: MaterialClassificationConfidence,
  ruleId: string | null,
  reason: string,
): MaterialClassification {
  return { category, method, confidence, confirmed: method === "manual", ruleId, reason };
}

const PRODUCT_NAME_RULES: ReadonlyArray<{ ruleId: string; pattern: RegExp; reason: string }> = [
  {
    ruleId: "product-window-door-block-v1",
    pattern: /(?:^|\s)(?:блок\s+(?:оконный|дверной)|окно|дверь|ворота)(?:\s|$)/,
    reason: "Name explicitly identifies a finished window, door, or gate product",
  },
  {
    ruleId: "product-reinforced-concrete-v1",
    pattern: /(?:^|\s)(?:изделие|изделия|конструкция|конструкции)\s+железобетонн/,
    reason: "Name explicitly identifies a reinforced-concrete product",
  },
];

export function classifyMaterialSource(source: MaterialRegisterSourceInput): MaterialClassification {
  if (source.manualClassification) {
    return classification(
      source.manualClassification,
      "manual",
      "high",
      null,
      "Classification was confirmed or corrected manually",
    );
  }

  const explicit = normalizeEstimateResourceType(source.resourceType);
  if (explicit === "material" || explicit === "equipment") {
    return classification(
      explicit,
      "resource_type",
      "high",
      `estimate-resource-type-${explicit}-v1`,
      `Estimate resource type explicitly identifies ${explicit}`,
    );
  }

  const normalizedName = normalizeMaterialName(source.name);
  for (const rule of PRODUCT_NAME_RULES) {
    if (rule.pattern.test(normalizedName)) {
      return classification("product", "rule", "medium", rule.ruleId, rule.reason);
    }
  }

  const code = displayText(source.resourceCode ?? "").toLocaleUpperCase("ru-RU");
  if (code.startsWith("ФССЦ") || code.startsWith("ФСБЦ")) {
    return classification(
      "material",
      "rule",
      "medium",
      "estimate-material-collection-code-v1",
      "Estimate code identifies a construction material price collection",
    );
  }

  return classification(
    "unclassified",
    "unclassified",
    "low",
    null,
    "No supported explicit resource type or narrow classification rule matched",
  );
}

export function materialDedupKey(category: MaterialCategory, normalizedName: string, normalizedUnit: string | null): string {
  return JSON.stringify([category, normalizedName, normalizedUnit]);
}

function requirementsFor(category: MaterialCategory): MaterialRequirementRule[] {
  if (category === "unclassified") return [];
  return MATERIAL_REQUIREMENT_RULES
    .filter((rule) => rule.category === category)
    .sort((a, b) => b.priority - a.priority || a.ruleId.localeCompare(b.ruleId));
}

function confidenceRank(value: MaterialClassificationConfidence): number {
  return value === "high" ? 2 : value === "medium" ? 1 : 0;
}

function aggregateClassification(sources: MaterialRegisterSource[]): MaterialClassification {
  const allManual = sources.every((source) => source.classification.method === "manual");
  if (allManual) return sources[0].classification;
  return sources
    .filter((source) => source.classification.method !== "manual")
    .reduce((lowest, source) =>
      confidenceRank(source.classification.confidence) < confidenceRank(lowest.confidence)
        ? source.classification
        : lowest,
    sources.find((source) => source.classification.method !== "manual")!.classification);
}

function normalizeSource(source: MaterialRegisterSourceInput): MaterialRegisterSource {
  const sourceName = displayText(source.name);
  const sourceUnit = source.unit == null ? null : displayText(source.unit) || null;
  return {
    ...source,
    sourceName,
    sourceUnit,
    normalizedName: normalizeMaterialName(source.name),
    normalizedUnit: normalizeMaterialUnit(source.unit),
    normalizedQuantity: parseEstimateNumeric(source.quantity),
    classification: classifyMaterialSource(source),
  };
}

/** Pure deterministic classification, safe deduplication and requirement selection. */
export function buildMaterialRegisterDraft(inputSources: readonly MaterialRegisterSourceInput[]): MaterialRegisterDraft {
  const groups = new Map<string, MaterialRegisterSource[]>();
  for (const input of inputSources) {
    const source = normalizeSource(input);
    const key = source.normalizedName
      ? materialDedupKey(source.classification.category, source.normalizedName, source.normalizedUnit)
      : JSON.stringify([source.classification.category, "", source.normalizedUnit, source.sourceType, source.sourceId]);
    const list = groups.get(key) ?? [];
    list.push(source);
    groups.set(key, list);
  }

  const items = Array.from(groups, ([dedupKey, sources]): MaterialRegisterItem => {
    const first = sources[0];
    const classification = aggregateClassification(sources);
    const quantities = sources.map((source) => source.normalizedQuantity).filter((value): value is number => value !== null);
    return {
      dedupKey,
      displayName: first.sourceName,
      normalizedName: first.normalizedName,
      displayUnit: first.sourceUnit,
      normalizedUnit: first.normalizedUnit,
      classification,
      quantity: quantities.length ? quantities.reduce((sum, value) => sum + value, 0) : null,
      sourceIds: sources.map(({ sourceType, sourceId }) => ({ sourceType, sourceId })),
      estimatePositionIds: Array.from(new Set(sources.map((source) => source.estimatePositionId))).sort((a, b) => a - b),
      sources,
      requirements: requirementsFor(classification.category),
    };
  });
  const blockingIssues = items
    .filter((item) => item.classification.category === "unclassified")
    .map((item): MaterialRegisterBlockingIssue => ({
      code: "MATERIAL_CLASSIFICATION_REQUIRED",
      blocking: true,
      dedupKey: item.dedupKey,
      sourceIds: item.sourceIds,
      reason: "Classification must be confirmed before automatic final completeness",
    }));

  return {
    rulesVersion: MATERIAL_REGISTER_RULES_VERSION,
    items,
    blockingIssues,
    ready: blockingIssues.length === 0,
  };
}
