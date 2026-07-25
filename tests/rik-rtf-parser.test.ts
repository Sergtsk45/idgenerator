/**
 * @file: rik-rtf-parser.test.ts
 * @description: Контрактные тесты импорта RTF-смет ПК РИК.
 * @dependencies: node:test, node:assert/strict, node:fs/promises, rikRtfEstimateParser
 * @created: 2026-07-25
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import { extractRikRtfTableRows } from "../client/src/lib/rikRtfTableExtractor.ts";
import { parseRikRtfEstimate, parseRikRtfEstimateRows } from "../client/src/lib/rikRtfEstimateParser.ts";

type GoldenContract = {
  fixtures: Array<{
    file: string;
    sha256: string;
    estimateNo: string;
    title: string;
    expectedImportedPositionCount: number;
    expectedTotalMarkerCount: number;
    expectedLineNos: [number, number];
    sections: Array<{
      name: string;
      subsections?: Array<{ name: string }>;
    }>;
    controlPositions: Record<
      "start" | "middle" | "end",
      Array<{
        lineNo: number;
        code: string;
        name: string;
        unit: string;
        sourceQuantity: string;
        section: string;
        subsection: string | null;
        sourceTotal: string;
      }>
    >;
  }>;
};

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[²]/g, "2")
    .replace(/[³]/g, "3")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumber(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .replace(",", ".");
}

function flattenGoldenSections(sections: GoldenContract["fixtures"][number]["sections"]): string[] {
  return sections.flatMap((section) => [section.name, ...(section.subsections ?? []).map((sub) => sub.name)]);
}

test("RTF extractor decodes CP1251 hex escapes, unicode escapes and table boundaries", () => {
  const input = bytes("{\\rtf1\\ansi\\ansicpg1251\\uc1\\trowd \\'cf\\'f0\\'e8\\'e2\\'e5\\'f2\\cell \\u1055?\\u1088?\\cell\\row}");

  const result = extractRikRtfTableRows(input);

  assert.deepEqual(result.rows, [["Привет", "Пр"]]);
});

test("RTF extractor skips pict destinations and binary payloads", () => {
  const input = bytes("{\\rtf1\\ansi{\\pict hidden}\\trowd visible\\bin3 abc\\cell done\\cell\\row}");

  const result = extractRikRtfTableRows(input);

  assert.deepEqual(result.rows, [["visible", "done"]]);
  assert.equal(result.stats.skippedBinaryBytes, 3);
});

test("RTF extractor rejects invalid signature, empty input and configured limits", () => {
  assert.throws(() => extractRikRtfTableRows(bytes("")), /RTF_IMPORT_EMPTY_FILE/);
  assert.throws(() => extractRikRtfTableRows(bytes("not rtf")), /RTF_IMPORT_INVALID_SIGNATURE/);
  assert.throws(
    () => extractRikRtfTableRows(bytes("{\\rtf1\\ansi\\trowd a\\cell\\row}"), { limits: { maxRows: 0 } }),
    /RTF_IMPORT_ROW_LIMIT_EXCEEDED/
  );
});

test("RIK parser honors service-number regression vector", async () => {
  const vector = JSON.parse(await readFile("docs/smeta-rtf/rik_service_number_test_vector.json", "utf8"));
  const rows = [vector.sourceColumns, ...vector.sourceRows];

  const result = parseRikRtfEstimateRows(rows, { fileName: "synthetic.rtf", requireRikSignature: false });
  const lineNos = result.payload.positions.map((p) => p.lineNo);

  assert.equal(result.payload.positions.length, vector.expected.importedPositionCount);
  assert.equal(result.payload.positions[0].lineNo, String(vector.expected.positions[0].lineNo));
  assert.equal(result.payload.positions[0].code, vector.expected.positions[0].code);
  assert.equal(result.payload.positions[0].name, vector.expected.positions[0].name);
  assert.equal(result.payload.positions[0].unit, vector.expected.positions[0].unit);
  assert.equal(result.payload.positions[0].quantity, normalizeNumber(vector.expected.positions[0].quantity));
  assert.equal(result.payload.positions[0].totalCurrentCost, normalizeNumber(vector.expected.positions[0].total));
  for (const forbidden of vector.expected.mustNotAppearAsLineNo) {
    assert.equal(lineNos.includes(String(forbidden)), false);
  }
});

test("RIK parser matches golden RTF contract", async () => {
  const contract = JSON.parse(await readFile("docs/smeta-rtf/rik_rtf_golden_contract.json", "utf8")) as GoldenContract;

  for (const fixture of contract.fixtures) {
    const buffer = await readFile(fixture.file);
    assert.equal(createHash("sha256").update(buffer).digest("hex"), fixture.sha256, fixture.file);

    const result = parseRikRtfEstimate(buffer, { fileName: fixture.file.split("/").pop() });
    const payload = result.payload;

    assert.equal(payload.estimate.code, fixture.estimateNo, fixture.file);
    assert.equal(payload.estimate.name, fixture.title, fixture.file);
    assert.equal(payload.positions.length, fixture.expectedImportedPositionCount, fixture.file);
    assert.equal(result.stats.totalMarkers, fixture.expectedTotalMarkerCount, fixture.file);
    assert.deepEqual(payload.resources, [], fixture.file);

    const expectedLineNos = Array.from(
      { length: fixture.expectedLineNos[1] - fixture.expectedLineNos[0] + 1 },
      (_v, idx) => String(fixture.expectedLineNos[0] + idx)
    );
    assert.deepEqual(payload.positions.map((p) => p.lineNo), expectedLineNos, fixture.file);

    assert.deepEqual(
      payload.sections.map((section) => section.title),
      flattenGoldenSections(fixture.sections),
      fixture.file
    );

    const sectionTitleByNumber = new Map(payload.sections.map((section) => [section.number, section.title]));
    const positionByLineNo = new Map(payload.positions.map((position) => [position.lineNo, position]));
    const controlPositions = [
      ...fixture.controlPositions.start,
      ...fixture.controlPositions.middle,
      ...fixture.controlPositions.end,
    ];

    for (const expected of controlPositions) {
      const actual = positionByLineNo.get(String(expected.lineNo));
      assert.ok(actual, `${fixture.file}: missing line ${expected.lineNo}`);
      assert.equal(actual.code, expected.code, `${fixture.file}: code ${expected.lineNo}`);
      assert.equal(normalizeText(actual.name), normalizeText(expected.name), `${fixture.file}: name ${expected.lineNo}`);
      assert.equal(actual.unit, expected.unit, `${fixture.file}: unit ${expected.lineNo}`);
      assert.equal(actual.quantity, normalizeNumber(expected.sourceQuantity), `${fixture.file}: qty ${expected.lineNo}`);
      assert.equal(actual.totalCurrentCost, normalizeNumber(expected.sourceTotal), `${fixture.file}: total ${expected.lineNo}`);
      assert.equal(
        sectionTitleByNumber.get(actual.sectionNumber ?? ""),
        expected.subsection ?? expected.section,
        `${fixture.file}: section ${expected.lineNo}`
      );
    }

    const importedText = payload.positions.map((position) => `${position.code} ${position.name}`).join("\n").toLowerCase();
    for (const forbidden of [
      "всего по позиции",
      "итого прямые затраты",
      "итого по разделу",
      "итоги по смете",
      "фот",
      "нр трубопроводы",
      "сп трубопроводы",
    ]) {
      assert.equal(importedText.includes(forbidden), false, `${fixture.file}: forbidden ${forbidden}`);
    }
  }
});

test("RIK parser rejects unsupported and structurally invalid RTF", () => {
  assert.throws(
    () => parseRikRtfEstimate(bytes("{\\rtf1\\ansi\\trowd plain\\cell\\row}"), { fileName: "plain.rtf" }),
    /RTF_IMPORT_HEADER_NOT_FOUND/
  );
  assert.throws(
    () =>
      parseRikRtfEstimateRows(
        [["номер", "№ п/п", "Обоснование", "Наименование работ и затрат", "Единица измерения", "Количество"]],
        { fileName: "not-rik.rtf" }
      ),
    /RTF_IMPORT_UNSUPPORTED_RIK_EXPORT/
  );
  assert.throws(
    () =>
      parseRikRtfEstimateRows(
        [
          ["Наименование программного продукта", "ПК РИК"],
          ["ЛОКАЛЬНЫЙ СМЕТНЫЙ РАСЧЕТ (СМЕТА) № 1"],
          ["номер", "№ п/п", "Обоснование", "Наименование работ и затрат", "Единица измерения", "Количество"],
        ],
        { fileName: "empty-rik.rtf" }
      ),
    /RTF_IMPORT_NO_POSITIONS/
  );
});

test("Works estimate preview counts flat positions payload", async () => {
  const source = await readFile("client/src/pages/Works.tsx", "utf8");

  assert.match(source, /parsed\.sections\.length/);
  assert.match(source, /parsed\.positions\.length/);
  assert.doesNotMatch(source, /sections\.reduce\([^)]*positions/s);
});
