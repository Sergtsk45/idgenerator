/**
 * @file: rikRtfEstimateParser.ts
 * @description: Парсер RTF-выгрузки ПК РИК в существующий payload импорта смет.
 * @dependencies: estimateParser, rikRtfTableExtractor
 * @created: 2026-07-25
 */

import type { ParsedEstimateImportPayload } from "./estimateParser";
import {
  extractRikRtfTableRows,
  type RikRtfTableExtractionStats,
  type RikRtfTableExtractorLimits,
} from "./rikRtfTableExtractor";

export type RikRtfEstimateParseStats = {
  tableRows: number;
  extractedRows: number;
  importedPositions: number;
  importedSections: number;
  totalMarkers: number;
  skippedRows: number;
  resourcesImported: 0;
  tableExtraction?: RikRtfTableExtractionStats;
};

export type RikRtfEstimateParseResult = {
  payload: ParsedEstimateImportPayload;
  warnings: string[];
  stats: RikRtfEstimateParseStats;
};

type HeaderMap = {
  rowIdx: number;
  serviceNo: number;
  lineNo: number;
  code: number;
  name: number;
  unit: number;
  quantity: number;
  quantityTotal: number | null;
  baseCostPerUnit: number | null;
  indexValue: number | null;
  currentCostPerUnit: number | null;
  totalCurrentCost: number | null;
};

type SectionState = {
  currentTopNumber: string | null;
  currentSectionNumber: string | null;
  nextTopNumber: number;
  nextSubNumberByTop: Map<string, number>;
};

type PendingPosition = {
  lineNo: string;
  positionIndex: number;
};

function norm(v: unknown): string {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/ё/g, "е")
    .replace(/Ё/g, "е")
    .replace(/[²]/g, "2")
    .replace(/[³]/g, "3")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function text(v: unknown): string {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[²]/g, "2")
    .replace(/[³]/g, "3")
    .replace(/[ \t\f\v]+/g, " ")
    .trim();
}

function rowText(row: string[]): string {
  return row.map(text).filter(Boolean).join(" ");
}

function isIntegerLineNo(value: unknown): boolean {
  return /^[1-9]\d*$/.test(text(value));
}

function isDecimalLineNo(value: unknown): boolean {
  return /^[1-9]\d*\.\d+$/.test(text(value));
}

function isNumericHeaderRow(row: string[], cols: HeaderMap): boolean {
  return text(row[cols.serviceNo]) === "1" && text(row[cols.lineNo]) === "2" && text(row[cols.code]) === "3";
}

function isNumberLike(value: unknown): boolean {
  return /^-?\d[\d\s]*(?:[.,]\d+)?$/.test(text(value));
}

function normalizeNumeric(value: unknown): string | null {
  const s = text(value);
  if (!s || !isNumberLike(s)) return null;
  return s.replace(/\s+/g, "").replace(",", ".");
}

function sourceNumeric(value: unknown): string | null {
  const s = text(value);
  return s && isNumberLike(s) ? s : null;
}

function rightmostNumeric(row: string[], preferredIdx: number | null): string | null {
  if (preferredIdx !== null) {
    const direct = normalizeNumeric(row[preferredIdx]);
    if (direct) return direct;
  }
  for (let i = row.length - 1; i >= 0; i--) {
    const n = normalizeNumeric(row[i]);
    if (n) return n;
  }
  return null;
}

function detectHeader(rows: string[][]): HeaderMap {
  for (let i = 0; i < Math.min(rows.length, 250); i++) {
    const cells = rows[i].map(norm);
    const lineNo = cells.findIndex((c) => c === "№ п/п" || c.includes("№ п/п"));
    const code = cells.findIndex((c) => c === "обоснование" || c.includes("обоснование"));
    const name = cells.findIndex((c) => c === "наименование работ и затрат" || c.includes("наименование работ и затрат"));
    const unit = cells.findIndex((c) => c === "единица измерения" || c.includes("единица измерения"));
    const quantity = cells.findIndex((c) => c === "количество" || c.includes("количество"));
    if (lineNo !== -1 && code !== -1 && name !== -1 && unit !== -1 && quantity !== -1) {
      const serviceNo =
        cells.findIndex((c, idx) => idx < lineNo && (c === "номер" || c.includes("номер"))) !== -1
          ? cells.findIndex((c, idx) => idx < lineNo && (c === "номер" || c.includes("номер")))
          : Math.max(0, lineNo - 1);

      const subHeader = rows[i + 1]?.map(norm) ?? [];
      const findSub = (needles: string[], fallback: number | null): number | null => {
        for (const needle of needles) {
          const idx = subHeader.findIndex((c) => c === needle || c.includes(needle));
          if (idx !== -1) return idx;
        }
        return fallback;
      };

      return {
        rowIdx: i,
        serviceNo,
        lineNo,
        code,
        name,
        unit,
        quantity,
        quantityTotal: findSub(["всего с учетом коэффициентов", "всего с учетом"], quantity + 2),
        baseCostPerUnit: findSub(["на единицу измерения в базисном уровне цен"], quantity + 3),
        indexValue: findSub(["индекс"], quantity + 4),
        currentCostPerUnit: findSub(["на единицу измерения в текущем уровне цен"], quantity + 5),
        totalCurrentCost: findSub(["всего в текущем уровне цен"], quantity + 7),
      };
    }
  }
  throw new Error("RTF_IMPORT_HEADER_NOT_FOUND");
}

function hasRikSignature(rows: string[][]): boolean {
  const first = norm(rows.slice(0, 80).map(rowText).join("\n"));
  return (
    first.includes("локальный сметный расчет") &&
    (first.includes("пк рик") || first.includes("наименование программного продукта"))
  );
}

function extractEstimateMeta(rows: string[][], fileName?: string): ParsedEstimateImportPayload["estimate"] {
  const estimate: ParsedEstimateImportPayload["estimate"] = {
    name: fileName?.replace(/\.rtf$/i, "") || "Смета РИК",
    code: null,
  };

  const window = rows.slice(0, Math.min(rows.length, 120));
  for (let i = 0; i < window.length; i++) {
    const line = rowText(window[i]);
    const nline = norm(line);

    if (!estimate.code && nline.includes("локальный сметный расчет") && nline.includes("№")) {
      const m = /№\s*([A-Za-zА-Яа-я0-9\-./]+)\b/.exec(line);
      if (m) estimate.code = m[1];
    }
    if (estimate.name === "Смета РИК" || estimate.name === fileName?.replace(/\.rtf$/i, "")) {
      if (nline.includes("локальный сметный расчет")) {
        const next = rowText(window[i + 1] ?? []);
        if (next && !/^\(/.test(next)) estimate.name = next;
      }
    }
    if (!estimate.objectName && nline.includes("наименование объекта")) {
      estimate.objectName = line.replace(/.*наименование объекта\s*:?/i, "").trim() || line;
    }
    if (!estimate.region && nline.includes("наименование субъекта")) {
      estimate.region = line.replace(/.*наименование субъекта\s*:?/i, "").trim() || null;
    }
    if (!estimate.pricingQuarter && (nline.includes("квартал") || nline.includes("текущ"))) {
      estimate.pricingQuarter = line;
    }
    if (!estimate.totalCost && nline.includes("сметная стоимость")) {
      estimate.totalCost = rightmostNumeric(window[i], null);
    }
  }

  if (estimate.name === "Смета РИК" || estimate.name === fileName?.replace(/\.rtf$/i, "")) {
    const titleRow = window.find((row) => row.length <= 3 && text(row[0]) && !/^локальный сметный расчет/i.test(text(row[0])));
    if (titleRow) estimate.name = text(titleRow[0]);
  }

  return estimate;
}

function isTotalMarker(row: string[], cols: HeaderMap): boolean {
  return norm(row[cols.name]) === "всего по позиции" || norm(rowText(row)) === "всего по позиции";
}

function isSkippedServiceRow(row: string[], cols: HeaderMap): boolean {
  const line = norm(rowText(row));
  if (!line) return true;
  if (isNumericHeaderRow(row, cols)) return true;
  if (isTotalMarker(row, cols)) return true;
  return (
    line.includes("итого прямые затраты") ||
    line.includes("итого по разделу") ||
    line.includes("итоги по смете") ||
    line.includes("всего по смете") ||
    line === "справочно" ||
    /(^|\s)фот($|\s)/.test(line) ||
    /^пр\/(812|774)/i.test(text(row[cols.code])) ||
    /^(от|эм|м|нр|сп|\d+\s+(от|эм|м))$/i.test(text(row[cols.name]))
  );
}

function isPositionRow(row: string[], cols: HeaderMap): boolean {
  return (
    isIntegerLineNo(row[cols.serviceNo]) &&
    isIntegerLineNo(row[cols.lineNo]) &&
    text(row[cols.code]) !== "" &&
    text(row[cols.name]) !== "" &&
    text(row[cols.unit]) !== "" &&
    sourceNumeric(row[cols.quantity]) !== null &&
    !isSkippedServiceRow(row, cols)
  );
}

function isAuxiliaryMaterialPositionRow(row: string[], cols: HeaderMap): boolean {
  const code = text(row[cols.code]);
  const line = norm(rowText(row));
  return (
    text(row[cols.serviceNo]) === "" &&
    isDecimalLineNo(row[cols.lineNo]) &&
    code !== "" &&
    text(row[cols.name]) !== "" &&
    text(row[cols.unit]) !== "" &&
    sourceNumeric(row[cols.quantity]) !== null &&
    !/^421\/пр/i.test(code) &&
    !line.includes("применение сметных норм") &&
    !isSkippedServiceRow(row, cols)
  );
}

function looksLikeHeading(row: string[], cols: HeaderMap): string | null {
  if (isSkippedServiceRow(row, cols)) return null;
  const candidates = row.map(text).filter(Boolean);
  if (candidates.length !== 1) return null;
  const value = candidates[0];
  const n = norm(value);
  if (/^раздел\s+\d+/i.test(value)) return value;
  if (text(row[cols.serviceNo]) || text(row[cols.lineNo])) return null;
  if (text(row[cols.code]) !== value && text(row[cols.name]) !== value) return null;
  if (!value || n.includes("локальный сметный расчет") || n.includes("обоснование") || n.includes("составлен")) return null;
  if (/^(согласовано|утверждаю|номер|№ п\/п|в том числе)$/i.test(value)) return null;
  if (/^формула ценообразования/i.test(value)) return null;
  if (/(^|,\s*)(зт|зтм|эм|м)\s*:/i.test(value)) return null;
  if (/^(от|эм|м|фот|нр|сп)$/i.test(value)) return null;
  return value;
}

function addSection(
  state: SectionState,
  sections: ParsedEstimateImportPayload["sections"],
  title: string,
  orderIndex: number
): string {
  const isExplicitTop = /^раздел\s+\d+/i.test(title);
  const isFirstSyntheticTop = !state.currentTopNumber;
  let number: string;

  if (isExplicitTop || isFirstSyntheticTop) {
    const m = /^раздел\s+(\d+)/i.exec(title);
    number = m?.[1] ?? "0";
    state.currentTopNumber = number;
    state.currentSectionNumber = number;
    if (!state.nextSubNumberByTop.has(number)) state.nextSubNumberByTop.set(number, 1);
  } else {
    const top = state.currentTopNumber!;
    const next = state.nextSubNumberByTop.get(top) ?? 1;
    number = `${top}.${next}`;
    state.nextSubNumberByTop.set(top, next + 1);
    state.currentSectionNumber = number;
  }

  if (!sections.some((s) => s.number === number)) {
    sections.push({ number, title, orderIndex });
  }
  return number;
}

export function parseRikRtfEstimateRows(
  rows: string[][],
  opts?: { fileName?: string; requireRikSignature?: boolean; tableExtraction?: RikRtfTableExtractionStats }
): RikRtfEstimateParseResult {
  const warnings: string[] = [];
  const cols = detectHeader(rows);
  if (opts?.requireRikSignature !== false && !hasRikSignature(rows)) {
    throw new Error("RTF_IMPORT_UNSUPPORTED_RIK_EXPORT");
  }

  const estimate = extractEstimateMeta(rows, opts?.fileName);
  const sections: ParsedEstimateImportPayload["sections"] = [];
  const positions: ParsedEstimateImportPayload["positions"] = [];
  const resources: ParsedEstimateImportPayload["resources"] = [];
  const sectionState: SectionState = {
    currentTopNumber: null,
    currentSectionNumber: null,
    nextTopNumber: 1,
    nextSubNumberByTop: new Map(),
  };
  let sectionOrder = 0;
  let positionOrder = 0;
  let skippedRows = 0;
  let totalMarkers = 0;
  let pending: PendingPosition | null = null;

  for (let i = cols.rowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];

    if (isTotalMarker(row, cols)) {
      totalMarkers++;
      if (pending) {
        const total = rightmostNumeric(row, cols.totalCurrentCost);
        if (total) positions[pending.positionIndex].totalCurrentCost = total;
        pending = null;
      }
      continue;
    }

    if (isPositionRow(row, cols)) {
      if (pending) {
        warnings.push(`Позиция ${pending.lineNo} не содержит строки "Всего по позиции"; сумма оставлена из основной строки или пустой`);
        pending = null;
      }
      if (!sectionState.currentSectionNumber) {
        addSection(sectionState, sections, "Без раздела", sectionOrder++);
      }
      const lineNo = text(row[cols.lineNo]);
      const position: ParsedEstimateImportPayload["positions"][number] = {
        sectionNumber: sectionState.currentSectionNumber,
        lineNo,
        code: text(row[cols.code]) || null,
        name: text(row[cols.name]),
        unit: text(row[cols.unit]) || null,
        quantity: normalizeNumeric(row[cols.quantity]),
        baseCostPerUnit: cols.baseCostPerUnit !== null ? normalizeNumeric(row[cols.baseCostPerUnit]) : null,
        indexValue: cols.indexValue !== null ? normalizeNumeric(row[cols.indexValue]) : null,
        currentCostPerUnit: cols.currentCostPerUnit !== null ? normalizeNumeric(row[cols.currentCostPerUnit]) : null,
        totalCurrentCost: cols.totalCurrentCost !== null ? normalizeNumeric(row[cols.totalCurrentCost]) : null,
        notes: null,
        orderIndex: positionOrder++,
      };
      positions.push(position);
      pending = { lineNo, positionIndex: positions.length - 1 };
      continue;
    }

    if (isAuxiliaryMaterialPositionRow(row, cols)) {
      if (!sectionState.currentSectionNumber) {
        addSection(sectionState, sections, "Без раздела", sectionOrder++);
      }
      positions.push({
        sectionNumber: sectionState.currentSectionNumber,
        lineNo: text(row[cols.lineNo]),
        code: text(row[cols.code]) || null,
        name: text(row[cols.name]),
        unit: text(row[cols.unit]) || null,
        quantity: normalizeNumeric(row[cols.quantity]),
        baseCostPerUnit: cols.baseCostPerUnit !== null ? normalizeNumeric(row[cols.baseCostPerUnit]) : null,
        indexValue: cols.indexValue !== null ? normalizeNumeric(row[cols.indexValue]) : null,
        currentCostPerUnit: cols.currentCostPerUnit !== null ? normalizeNumeric(row[cols.currentCostPerUnit]) : null,
        totalCurrentCost: cols.totalCurrentCost !== null ? normalizeNumeric(row[cols.totalCurrentCost]) : null,
        notes: null,
        orderIndex: positionOrder++,
      });
      continue;
    }

    const heading = looksLikeHeading(row, cols);
    if (heading) {
      if (pending) {
        warnings.push(`Позиция ${pending.lineNo} не содержит строки "Всего по позиции" перед новым разделом`);
        pending = null;
      }
      addSection(sectionState, sections, heading, sectionOrder++);
      continue;
    }

    skippedRows++;
  }

  if (!estimate.code) warnings.push("Не удалось однозначно определить номер сметы");
  if (totalMarkers !== positions.length) {
    warnings.push(`Количество строк "Всего по позиции" (${totalMarkers}) не совпадает с количеством позиций (${positions.length})`);
  }
  if (positions.length === 0) throw new Error("RTF_IMPORT_NO_POSITIONS");

  return {
    payload: {
      estimate,
      sections,
      positions,
      resources,
    },
    warnings,
    stats: {
      tableRows: rows.length,
      extractedRows: rows.length,
      importedPositions: positions.length,
      importedSections: sections.length,
      totalMarkers,
      skippedRows,
      resourcesImported: 0,
      tableExtraction: opts?.tableExtraction,
    },
  };
}

export function parseRikRtfEstimate(
  input: ArrayBuffer | Uint8Array,
  opts?: { fileName?: string; limits?: Partial<RikRtfTableExtractorLimits> }
): RikRtfEstimateParseResult {
  const extraction = extractRikRtfTableRows(input, { limits: opts?.limits });
  return parseRikRtfEstimateRows(extraction.rows, {
    fileName: opts?.fileName,
    requireRikSignature: true,
    tableExtraction: extraction.stats,
  });
}
