import test from "node:test";
import assert from "node:assert/strict";

import {
  getEstimatePositionLaborHours,
  isMainEstimatePosition,
  isManHourUnit,
  normalizeEstimateResourceType,
  parseEstimateNumeric,
} from "../shared/estimateClassification.ts";

test("estimate main works use only supported normative prefixes", () => {
  assert.equal(isMainEstimatePosition({ code: " гэсн15-01 " }), true);
  assert.equal(isMainEstimatePosition({ code: "ФЕР01-01" }), true);
  assert.equal(isMainEstimatePosition({ code: "ТЕР06-01" }), true);
  assert.equal(isMainEstimatePosition({ code: "ФСБЦ101-1" }), false);
  assert.equal(isMainEstimatePosition({ code: "10" }), false);
  assert.equal(isMainEstimatePosition({ code: null }), false);
});

test("resource normalization is conservative", () => {
  assert.equal(normalizeEstimateResourceType("(ОТ)"), "labor");
  assert.equal(normalizeEstimateResourceType(" отм "), "labor");
  assert.equal(normalizeEstimateResourceType("М"), "material");
  assert.equal(normalizeEstimateResourceType("эм"), "equipment");
  assert.equal(normalizeEstimateResourceType("Н"), "unclassified");
  assert.equal(normalizeEstimateResourceType(null), "unclassified");
});

test("numeric and man-hour helpers support imported estimate formats", () => {
  assert.equal(parseEstimateNumeric("1 234,56"), 1234.56);
  assert.equal(parseEstimateNumeric(""), null);
  assert.equal(parseEstimateNumeric("not-a-number"), null);
  assert.equal(isManHourUnit("чел.-ч"), true);
  assert.equal(isManHourUnit("человеко-час"), true);
  assert.equal(isManHourUnit("чел."), false);
  assert.equal(isManHourUnit("маш.-ч"), false);
});

test("labor calculation prefers typed OT/OTM and quantityTotal", () => {
  assert.equal(getEstimatePositionLaborHours([
    { resourceType: "ОТ", unit: "чел.-ч", quantity: "2", quantityTotal: "10,5" },
    { resourceType: "(ОТм)", unit: "чел.-ч", quantityTotal: "1 000,25" },
    { resourceType: null, unit: "чел.-ч", quantityTotal: "999" },
  ]), 1010.75);
});

test("labor calculation rejects unsupported units and non-positive values", () => {
  assert.equal(getEstimatePositionLaborHours([
    { resourceType: "ОТ", unit: "руб.", quantityTotal: "100" },
    { resourceType: null, unit: "чел.-ч", quantityTotal: "3" },
  ]), 3);
  assert.equal(getEstimatePositionLaborHours([
    { resourceType: "ОТ", unit: "чел.-ч", quantityTotal: "-2" },
  ]), null);
});

test("labor calculation falls back only to untyped man-hour resources", () => {
  assert.equal(getEstimatePositionLaborHours([
    { resourceType: null, unit: "чел.-ч", quantity: "7,5" },
    { resourceType: "М", unit: "чел.-ч", quantityTotal: "100" },
  ]), 7.5);
  assert.equal(getEstimatePositionLaborHours([{ resourceType: "М", unit: "т", quantityTotal: "4" }]), null);
  assert.equal(getEstimatePositionLaborHours([{ resourceType: "ОТ", unit: "чел.-ч", quantityTotal: "0" }]), null);
});
