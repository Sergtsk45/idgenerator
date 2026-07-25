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
    expectedAuxiliaryPositionCount?: number;
    expectedTotalEstimatePositionCount?: number;
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
  assert.throws(
    () => extractRikRtfTableRows(bytes("{\\rtf1\\ansi{{{deep}}}}"), { limits: { maxGroupDepth: 2 } }),
    /RTF_IMPORT_GROUP_DEPTH_LIMIT_EXCEEDED/
  );
});

test("RIK parser honors service-number regression vector", async () => {
  const vector = JSON.parse(await readFile("docs/smeta-rtf/rik_service_number_test_vector.json", "utf8"));
  const rows = [vector.sourceColumns, ...vector.sourceRows];

  const result = parseRikRtfEstimateRows(rows, { fileName: "synthetic.rtf", requireRikSignature: false });
  const lineNos = result.payload.positions.map((p) => p.lineNo);

  const mainPositions = result.payload.positions.filter((position) => /^\d+$/.test(position.lineNo));
  assert.equal(mainPositions.length, vector.expected.importedMainPositionCount);
  assert.equal(mainPositions[0].lineNo, String(vector.expected.positions[0].lineNo));
  assert.equal(mainPositions[0].code, vector.expected.positions[0].code);
  assert.equal(mainPositions[0].name, vector.expected.positions[0].name);
  assert.equal(mainPositions[0].unit, vector.expected.positions[0].unit);
  assert.equal(mainPositions[0].quantity, normalizeNumber(vector.expected.positions[0].quantity));
  assert.equal(mainPositions[0].totalCurrentCost, normalizeNumber(vector.expected.positions[0].total));
  assert.equal(lineNos.includes("9001"), false);
  assert.equal(lineNos.includes("7.1"), true);
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
    const mainPositions = payload.positions.filter((position) => /^\d+$/.test(position.lineNo));
    assert.equal(mainPositions.length, fixture.expectedImportedPositionCount, fixture.file);
    if (fixture.expectedAuxiliaryPositionCount !== undefined) {
      assert.equal(
        payload.positions.filter((position) => /^\d+\.\d+$/.test(position.lineNo)).length,
        fixture.expectedAuxiliaryPositionCount,
        fixture.file
      );
    }
    if (fixture.expectedTotalEstimatePositionCount !== undefined) {
      assert.equal(payload.positions.length, fixture.expectedTotalEstimatePositionCount, fixture.file);
    }
    assert.equal(result.stats.totalMarkers, fixture.expectedTotalMarkerCount, fixture.file);
    assert.deepEqual(payload.resources, [], fixture.file);

    const expectedLineNos = Array.from(
      { length: fixture.expectedLineNos[1] - fixture.expectedLineNos[0] + 1 },
      (_v, idx) => String(fixture.expectedLineNos[0] + idx)
    );
    assert.deepEqual(mainPositions.map((p) => p.lineNo), expectedLineNos, fixture.file);

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

test("RIK parser imports material subrows as auxiliary estimate positions", async () => {
  const fixtures = [
    {
      file: "docs/smeta-rtf/02-01-02 Ремонт системы отопления.rtf",
      rows: [
        ["3.1", "23.5.02.02-0055", "Трубы стальные электросварные прямошовные", "м", "100"],
        ["3.2", "23.8.04.06-0072", "Отвод 90°", "шт", "20"],
        ["3.3", "08.4.02.04-0001", "Каркасы металлические", "т", "1.5683"],
      ],
    },
    {
      file: "docs/smeta-rtf/02-01-04 Ремонт системы водоснабжения.rtf",
      rows: [
        ["6.1", "23.3.06.02-0006", "Трубы стальные сварные оцинкованные", "м", "100"],
        ["17.1", "24.3.02.05-0004", "Трубы полипропиленовые ПП-Р", "м", "102.5"],
        ["17.2", "23.1.02.06-0034", "Хомуты металлические оцинкованные", "10 шт", "5"],
      ],
    },
  ] as const;

  for (const fixture of fixtures) {
    const result = parseRikRtfEstimate(await readFile(fixture.file), { fileName: fixture.file.split("/").pop() });
    const auxiliaryPositions = result.payload.positions.filter((position) => /^\d+\.\d+$/.test(position.lineNo));
    assert.ok(auxiliaryPositions.length > 0, fixture.file);

    for (const [lineNo, code, namePart, unit, quantity] of fixture.rows) {
      const row = result.payload.positions.find((position) => position.lineNo === lineNo);
      assert.ok(row, `${fixture.file}: missing auxiliary ${lineNo}`);
      assert.equal(row.code, code);
      assert.match(row.name, new RegExp(namePart));
      assert.equal(row.unit, unit);
      assert.equal(row.quantity, quantity);
    }

    assert.equal(
      auxiliaryPositions.some((position) => String(position.code ?? "").startsWith("421/пр")),
      false,
      `${fixture.file}: coefficient rows must not be auxiliary positions`
    );
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
          ["ЛОКАЛЬНЫЙ СМЕТНЫЙ РАСЧЕТ (СМЕТА) № 1", "слово рикошет не является подписью продукта"],
          ["номер", "№ п/п", "Обоснование", "Наименование работ и затрат", "Единица измерения", "Количество"],
        ],
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

test("RIK parser moves to a new section even if previous position has no total marker", () => {
  const result = parseRikRtfEstimateRows(
    [
      ["Наименование программного продукта", "ПК РИК"],
      ["ЛОКАЛЬНЫЙ СМЕТНЫЙ РАСЧЕТ (СМЕТА) № 1"],
      ["Тестовая смета"],
      ["номер", "№ п/п", "Обоснование", "Наименование работ и затрат", "Единица измерения", "Количество"],
      ["", "", "", "", "", "на единицу измерения", "коэффициенты", "всего с учётом коэффициентов", "", "", "", "", "всего в текущем уровне цен"],
      ["1", "1", "ГЭСН 01-01-001-01", "Позиция без итога", "шт", "1", "", "1", "", "", "", "", ""],
      ["Раздел 1. Новый раздел"],
      ["2", "2", "ГЭСН 01-01-001-02", "Позиция нового раздела", "шт", "2", "", "2", "", "", "", "", ""],
      ["", "", "", "Всего по позиции", "", "", "", "", "", "", "", "", "20,00"],
    ],
    { fileName: "broken-section.rtf" }
  );

  assert.match(result.warnings.join("\n"), /не содержит строки "Всего по позиции"/);
  assert.equal(result.payload.sections.at(-1)?.title, "Раздел 1. Новый раздел");
  assert.equal(result.payload.positions[1].sectionNumber, "1");
  assert.equal(result.payload.positions[1].totalCurrentCost, "20.00");
});

test("RIK worker client has timeout and abort lifecycle controls", async () => {
  const source = await readFile("client/src/lib/rikRtfWorkerClient.ts", "utf8");
  const worksSource = await readFile("client/src/pages/Works.tsx", "utf8");

  assert.match(source, /timeoutMs.*60_000/);
  assert.match(source, /RTF_IMPORT_WORKER_TIMEOUT/);
  assert.match(source, /abort:/);
  assert.match(source, /worker\.terminate\(\)/);
  assert.match(worksSource, /currentRikRtfParseRef\.current\?\.abort\(\)/);
  assert.match(worksSource, /isMountedRef/);
});

test("Works estimate preview counts flat positions payload", async () => {
  const source = await readFile("client/src/pages/Works.tsx", "utf8");

  assert.match(source, /parsed\.sections\.length/);
  assert.match(source, /parsed\.positions\.length/);
  assert.doesNotMatch(source, /sections\.reduce\([^)]*positions/s);
});
