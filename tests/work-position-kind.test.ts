/**
 * @file: work-position-kind.test.ts
 * @description: Unit-тесты классификации основных/вспомогательных позиций ВОР и группировки подстрок.
 * @dependencies: node:test, node:assert/strict, shared/workPositionKind
 * @created: 2026-07-29
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  compareWorksOrder,
  groupAuxiliaryWorksByMainId,
  isMainWorkPosition,
} from "../shared/workPositionKind.ts";

test("isMainWorkPosition: integer codes are main, fractional are auxiliary", () => {
  assert.equal(isMainWorkPosition({ code: "1" }), true);
  assert.equal(isMainWorkPosition({ code: "10" }), true);
  assert.equal(isMainWorkPosition({ code: "10.1" }), false);
  assert.equal(isMainWorkPosition({ code: "10.2" }), false);
  assert.equal(isMainWorkPosition({ code: "9.1" }), false);
});

test("isMainWorkPosition: FER/GESN/TER are main; FSSC/Price are auxiliary", () => {
  assert.equal(isMainWorkPosition({ code: "ФЕР01-01-001-01" }), true);
  assert.equal(isMainWorkPosition({ code: "ГЭСН15-01-001-01" }), true);
  assert.equal(isMainWorkPosition({ code: "ТЕР06-01-001" }), true);
  assert.equal(isMainWorkPosition({ code: "ФССЦ101-1234" }), false);
  assert.equal(isMainWorkPosition({ code: "Цена/прайс-1" }), false);
  assert.equal(isMainWorkPosition({ code: "цена 12" }), false);
});

test("isMainWorkPosition: lineNo overrides code when present", () => {
  assert.equal(isMainWorkPosition({ code: "ФССЦ-1", lineNo: "10" }), true);
  assert.equal(isMainWorkPosition({ code: "ФЕР01", lineNo: "10.1" }), false);
});

test("isMainWorkPosition: empty code is not main", () => {
  assert.equal(isMainWorkPosition({ code: "" }), false);
  assert.equal(isMainWorkPosition({ code: null }), false);
  assert.equal(isMainWorkPosition({}), false);
});

test("groupAuxiliaryWorksByMainId: attaches 10.1/10.2 under 10", () => {
  const rows = [
    { id: 1, code: "9" },
    { id: 2, code: "9.1" },
    { id: 3, code: "10" },
    { id: 4, code: "10.1" },
    { id: 5, code: "10.2" },
    { id: 6, code: "11" },
  ];

  const map = groupAuxiliaryWorksByMainId(rows);

  assert.deepEqual(
    (map.get(1) ?? []).map((w) => w.code),
    ["9.1"]
  );
  assert.deepEqual(
    (map.get(3) ?? []).map((w) => w.code),
    ["10.1", "10.2"]
  );
  assert.deepEqual(map.get(6) ?? [], []);
  assert.equal(map.has(2), false);
});

test("bootstrap filter: only main rows become schedule tasks", () => {
  const worksList = [
    { id: 1, code: "1" },
    { id: 2, code: "1.1" },
    { id: 3, code: "ФЕР01-02" },
    { id: 4, code: "ФССЦ-99" },
    { id: 5, code: "2" },
    { id: 6, code: "2.1" },
  ];

  const mainIds = worksList.filter((w) => isMainWorkPosition(w)).map((w) => w.id);
  assert.deepEqual(mainIds, [1, 3, 5]);
});

test("compareWorksOrder: collection, orderIndex, numeric code, then id", () => {
  const rows = [
    { orderIndex: 2, code: "10" },
    { orderIndex: 1, code: "2" },
    { orderIndex: 1, code: "10" },
  ];
  const sorted = [...rows].sort(compareWorksOrder);
  assert.deepEqual(
    sorted.map((r) => r.code),
    ["2", "10", "10"]
  );
});

test("collection-local order keeps auxiliary rows under their numeric parent", () => {
  const rows = [
    { id: 1, workCollectionId: 1, orderIndex: 10, code: "10" },
    { id: 2, workCollectionId: 1, orderIndex: 11, code: "10.1" },
    { id: 3, workCollectionId: 2, orderIndex: 9, code: "40" },
    { id: 4, workCollectionId: 2, orderIndex: 10, code: "40.2" },
  ].sort(compareWorksOrder);

  assert.deepEqual(rows.map((r) => r.code), ["10", "10.1", "40", "40.2"]);

  const map = groupAuxiliaryWorksByMainId(rows);
  assert.deepEqual((map.get(1) ?? []).map((w) => w.code), ["10.1"]);
  assert.deepEqual((map.get(3) ?? []).map((w) => w.code), ["40.2"]);
});

test("numeric auxiliary without a parent in its collection stays ungrouped", () => {
  const rows = [
    { id: 1, workCollectionId: 1, orderIndex: 1, code: "10" },
    { id: 2, workCollectionId: 2, orderIndex: 1, code: "40.2" },
  ].sort(compareWorksOrder);

  const map = groupAuxiliaryWorksByMainId(rows);
  assert.deepEqual(map.get(1) ?? [], []);
});

test("repeated numeric parent uses the nearest preceding main row", () => {
  const rows = [
    { id: 1, workCollectionId: 1, code: "10" },
    { id: 2, workCollectionId: 1, code: "10.1" },
    { id: 3, workCollectionId: 1, code: "10" },
    { id: 4, workCollectionId: 1, code: "10.2" },
  ];

  const map = groupAuxiliaryWorksByMainId(rows);
  assert.deepEqual((map.get(1) ?? []).map((w) => w.code), ["10.1"]);
  assert.deepEqual((map.get(3) ?? []).map((w) => w.code), ["10.2"]);
});

test("nonnumeric auxiliary fallback never crosses collection boundaries", () => {
  const rows = [
    { id: 1, workCollectionId: 1, code: "1" },
    { id: 2, workCollectionId: 2, code: "2" },
    { id: 3, workCollectionId: 1, code: "ФССЦ-1" },
    { id: 4, workCollectionId: 2, code: "Цена 2" },
  ];

  const map = groupAuxiliaryWorksByMainId(rows);
  assert.deepEqual((map.get(1) ?? []).map((w) => w.code), ["ФССЦ-1"]);
  assert.deepEqual((map.get(2) ?? []).map((w) => w.code), ["Цена 2"]);
});
