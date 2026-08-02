import assert from "node:assert/strict";
import test from "node:test";

import {
  MATERIAL_REGISTER_RULES_VERSION,
  buildMaterialRegisterDraft,
  classifyMaterialSource,
  normalizeMaterialName,
  normalizeMaterialUnit,
  type MaterialRegisterSourceInput,
} from "../server/services/material-register/materialRegisterCore";

function source(overrides: Partial<MaterialRegisterSourceInput> = {}): MaterialRegisterSourceInput {
  return {
    sourceType: "resource",
    sourceId: 1,
    estimateId: 10,
    estimatePositionId: 100,
    resourceType: "М",
    resourceCode: "101-0001",
    name: "Кирпич М100",
    unit: "шт.",
    quantity: "10,5",
    ...overrides,
  };
}

test("normalization is conservative and preserves model-significant tokens", () => {
  assert.equal(normalizeMaterialName("  Насос\u00a0ABC-100  "), "насос abc-100");
  assert.notEqual(normalizeMaterialName("Насос ABC-100"), normalizeMaterialName("Насос ABC-200"));
  assert.equal(normalizeMaterialUnit("шт."), "шт");
  assert.equal(normalizeMaterialUnit("м^2"), "м²");
  assert.equal(normalizeMaterialUnit("марка-X.1"), "марка-x.1");
  assert.equal(normalizeMaterialUnit(null), null);
});

test("explicit estimate resource types classify before name rules", () => {
  const material = classifyMaterialSource(source({ name: "Блок оконный", resourceType: "М" }));
  const equipment = classifyMaterialSource(source({ resourceType: "ЭМ" }));

  assert.deepEqual([material.category, material.method, material.confidence], ["material", "resource_type", "high"]);
  assert.deepEqual([equipment.category, equipment.method, equipment.confidence], ["equipment", "resource_type", "high"]);
});

test("narrow rules identify products and material collection codes, unknown rows stay unclassified", () => {
  assert.equal(classifyMaterialSource(source({ resourceType: null, name: "Блок оконный ПВХ ABC-10" })).category, "product");
  assert.equal(classifyMaterialSource(source({ resourceType: null, resourceCode: "ФССЦ-101", name: "Щебень" })).category, "material");
  assert.equal(classifyMaterialSource(source({ resourceType: null, resourceCode: null, name: "Неясная позиция" })).category, "unclassified");
});

test("manual classification has priority and is confirmed", () => {
  const result = classifyMaterialSource(source({ resourceType: "ЭМ", manualClassification: "product" }));
  assert.deepEqual(
    { category: result.category, method: result.method, confidence: result.confidence, confirmed: result.confirmed },
    { category: "product", method: "manual", confidence: "high", confirmed: true },
  );
});

test("exact category, normalized name and unit deduplicate safely while retaining all sources", () => {
  const result = buildMaterialRegisterDraft([
    source(),
    source({ sourceId: 2, estimatePositionId: 101, name: "  КИРПИЧ   М100 ", unit: "шт", quantity: 2 }),
    source({ sourceId: 3, name: "Кирпич М150", unit: "шт" }),
    source({ sourceId: 4, name: "Кирпич М100", unit: "кг" }),
    source({ sourceId: 5, name: "Кирпич М100", unit: "шт", manualClassification: "product" }),
  ]);

  assert.equal(result.items.length, 4);
  const merged = result.items.find((item) => item.normalizedName === "кирпич м100" && item.normalizedUnit === "шт" && item.classification.category === "material");
  assert.ok(merged);
  assert.equal(merged.quantity, 12.5);
  assert.deepEqual(merged.sourceIds, [
    { sourceType: "resource", sourceId: 1 },
    { sourceType: "resource", sourceId: 2 },
  ]);
  assert.deepEqual(merged.estimatePositionIds, [100, 101]);
  assert.equal(merged.sources[0].sourceName, "Кирпич М100");
  assert.equal(merged.sources[0].sourceUnit, "шт.");
});

test("empty names never merge unrelated source rows", () => {
  const result = buildMaterialRegisterDraft([
    source({ sourceId: 1, name: "", resourceType: null }),
    source({ sourceId: 2, name: "  ", resourceType: null }),
  ]);
  assert.equal(result.items.length, 2);
});

test("seed requirements are stable any-of rules with explicit reasons", () => {
  const result = buildMaterialRegisterDraft([
    source(),
    source({ sourceId: 2, resourceType: "ЭМ", name: "Экскаватор", unit: "маш.-ч" }),
    source({ sourceId: 3, resourceType: null, name: "Дверь стальная D-10", unit: "шт" }),
  ]);

  assert.equal(result.rulesVersion, MATERIAL_REGISTER_RULES_VERSION);
  const byCategory = new Map(result.items.map((item) => [item.classification.category, item]));
  assert.deepEqual(byCategory.get("material")?.requirements[0].acceptableDocTypes, ["certificate", "declaration", "passport"]);
  assert.deepEqual(byCategory.get("equipment")?.requirements[0].acceptableDocTypes, ["passport"]);
  assert.deepEqual(byCategory.get("product")?.requirements[0].acceptableDocTypes, ["certificate", "passport"]);
  for (const item of result.items) {
    assert.equal(item.requirements[0].match, "any");
    assert.match(item.requirements[0].reason, /normative sufficiency is not asserted/);
  }
});

test("unclassified rows remain visible but block automatic completeness", () => {
  const result = buildMaterialRegisterDraft([
    source({ resourceType: null, resourceCode: null, name: "Неясная позиция" }),
  ]);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].classification.category, "unclassified");
  assert.deepEqual(result.items[0].requirements, []);
  assert.equal(result.ready, false);
  assert.equal(result.blockingIssues[0].code, "MATERIAL_CLASSIFICATION_REQUIRED");
  assert.deepEqual(result.blockingIssues[0].sourceIds, [{ sourceType: "resource", sourceId: 1 }]);
});

test("pure rebuild is deterministic", () => {
  const input = [source(), source({ sourceId: 2, name: "Блок дверной D-20", resourceType: null })];
  assert.deepEqual(buildMaterialRegisterDraft(input), buildMaterialRegisterDraft(input));
});
