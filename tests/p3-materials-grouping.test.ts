/**
 * @file: p3-materials-grouping.test.ts
 * @description: Grouped п.3 materials text for multi-doc D′ rows
 * @created: 2026-08-01
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatP3DocFragment, formatP3MaterialsGrouped } from "../shared/p3MaterialsText.ts";

describe("formatP3DocFragment", () => {
  it("formats passport with bare number", () => {
    assert.equal(formatP3DocFragment("passport", "0091"), "паспорт зав. №0091");
  });

  it("keeps existing зав. № prefix", () => {
    assert.equal(
      formatP3DocFragment("passport", "Зав. № ППА.25.10.0000096"),
      "паспорт Зав. № ППА.25.10.0000096",
    );
  });
});

describe("formatP3MaterialsGrouped", () => {
  it("lists several docs for one material in one phrase", () => {
    const text = formatP3MaterialsGrouped([
      {
        projectMaterialId: 23,
        orderIndex: 0,
        materialName: "Термометр БиТ-63",
        docType: "passport",
        docNumber: "0091",
        hasDocument: true,
      },
      {
        projectMaterialId: 23,
        orderIndex: 1,
        materialName: "Термометр БиТ-63",
        docType: "passport",
        docNumber: "0096",
        hasDocument: true,
      },
    ]);
    assert.equal(text, "Термометр БиТ-63 паспорт зав. №0091, паспорт зав. №0096");
  });

  it("keeps different materials separate", () => {
    const text = formatP3MaterialsGrouped([
      {
        projectMaterialId: 23,
        orderIndex: 0,
        materialName: "Термометр БиТ-63",
        docType: "passport",
        docNumber: "0091",
        hasDocument: true,
      },
      {
        projectMaterialId: 22,
        orderIndex: 1,
        materialName: "Манометр МаТ.100",
        docType: "passport",
        docNumber: "0078",
        hasDocument: true,
      },
    ]);
    assert.equal(
      text,
      "Термометр БиТ-63 паспорт зав. №0091; Манометр МаТ.100 паспорт зав. №0078",
    );
  });

  it("dedupes identical doc fragments for the same material", () => {
    const text = formatP3MaterialsGrouped([
      {
        projectMaterialId: 1,
        materialName: "Кран",
        docType: "passport",
        docNumber: "1",
        hasDocument: true,
      },
      {
        projectMaterialId: 1,
        materialName: "Кран",
        docType: "passport",
        docNumber: "1",
        hasDocument: true,
      },
    ]);
    assert.equal(text, "Кран паспорт зав. №1");
  });
});
