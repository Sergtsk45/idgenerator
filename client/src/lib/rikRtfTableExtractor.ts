/**
 * @file: rikRtfTableExtractor.ts
 * @description: Ограниченный безопасный декодер табличного текста RTF-выгрузки ПК РИК.
 * @dependencies: TextDecoder
 * @created: 2026-07-25
 */

export type RikRtfTableExtractorLimits = {
  maxFileBytes: number;
  maxGroupDepth: number;
  maxRows: number;
  maxCellsPerRow: number;
  maxCellChars: number;
};

export type RikRtfTableExtractionStats = {
  rowCount: number;
  maxCellsInRow: number;
  skippedBinaryBytes: number;
};

export type RikRtfTableExtractionResult = {
  rows: string[][];
  stats: RikRtfTableExtractionStats;
};

export const DEFAULT_RIK_RTF_LIMITS: RikRtfTableExtractorLimits = {
  maxFileBytes: 15 * 1024 * 1024,
  maxGroupDepth: 512,
  maxRows: 20_000,
  maxCellsPerRow: 80,
  maxCellChars: 20_000,
};

const DESTINATIONS_TO_SKIP = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "object",
  "header",
  "footer",
  "headerl",
  "headerr",
  "headerf",
  "footerl",
  "footerr",
  "footerf",
  "xmlopen",
  "xmlclose",
  "themedata",
  "datastore",
]);

const CONTROL_SYMBOLS: Record<string, string> = {
  "~": " ",
  "_": "-",
  "{": "{",
  "}": "}",
  "\\": "\\",
};

type GroupState = {
  skip: boolean;
  uc: number;
};

function toUint8Array(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function decodeByte(decoder: TextDecoder, byte: number): string {
  return decoder.decode(Uint8Array.of(byte));
}

function isAlpha(byte: number): boolean {
  return (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122);
}

function isDigit(byte: number): boolean {
  return byte >= 48 && byte <= 57;
}

function hexValue(byte: number): number {
  if (byte >= 48 && byte <= 57) return byte - 48;
  if (byte >= 65 && byte <= 70) return byte - 55;
  if (byte >= 97 && byte <= 102) return byte - 87;
  return -1;
}

function normalizeCell(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[²]/g, "2")
    .replace(/[³]/g, "3")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function appendText(currentCell: string[], text: string, limits: RikRtfTableExtractorLimits): void {
  if (!text) return;
  if (currentCell.length + text.length > limits.maxCellChars) {
    throw new Error("RTF_IMPORT_CELL_LIMIT_EXCEEDED");
  }
  currentCell.push(text);
}

function pushCell(row: string[], currentCell: string[], limits: RikRtfTableExtractorLimits): void {
  if (row.length >= limits.maxCellsPerRow) {
    throw new Error("RTF_IMPORT_CELL_COUNT_LIMIT_EXCEEDED");
  }
  row.push(normalizeCell(currentCell.join("")));
  currentCell.length = 0;
}

function pushRow(rows: string[][], row: string[], limits: RikRtfTableExtractorLimits): void {
  const normalized = row.map(normalizeCell);
  if (normalized.some(Boolean)) {
    if (rows.length >= limits.maxRows) {
      throw new Error("RTF_IMPORT_ROW_LIMIT_EXCEEDED");
    }
    rows.push(normalized);
  }
  row.length = 0;
}

export function extractRikRtfTableRows(
  input: ArrayBuffer | Uint8Array,
  opts?: { limits?: Partial<RikRtfTableExtractorLimits> }
): RikRtfTableExtractionResult {
  const bytes = toUint8Array(input);
  const limits = { ...DEFAULT_RIK_RTF_LIMITS, ...(opts?.limits ?? {}) };

  if (bytes.byteLength === 0) throw new Error("RTF_IMPORT_EMPTY_FILE");
  if (bytes.byteLength > limits.maxFileBytes) throw new Error("RTF_IMPORT_FILE_LIMIT_EXCEEDED");
  if (bytes[0] !== 123 || bytes[1] !== 92 || bytes[2] !== 114 || bytes[3] !== 116 || bytes[4] !== 102) {
    throw new Error("RTF_IMPORT_INVALID_SIGNATURE");
  }

  const decoder = new TextDecoder("windows-1251");
  const rows: string[][] = [];
  const row: string[] = [];
  const currentCell: string[] = [];
  const stack: GroupState[] = [{ skip: false, uc: 1 }];
  let skippedBinaryBytes = 0;

  const current = () => stack[stack.length - 1] ?? { skip: false, uc: 1 };
  const setCurrent = (patch: Partial<GroupState>) => {
    const idx = stack.length - 1;
    stack[idx] = { ...stack[idx], ...patch };
  };

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    const state = current();

    if (byte === 123) {
      if (stack.length >= limits.maxGroupDepth) {
        throw new Error("RTF_IMPORT_GROUP_DEPTH_LIMIT_EXCEEDED");
      }
      stack.push({ ...state });
      continue;
    }
    if (byte === 125) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (byte === 92) {
      const next = bytes[++i];
      if (next === undefined) break;

      if (next === 39) {
        const hi = hexValue(bytes[++i]);
        const lo = hexValue(bytes[++i]);
        if (hi < 0 || lo < 0) throw new Error("RTF_IMPORT_CORRUPTED_HEX_ESCAPE");
        if (!current().skip) appendText(currentCell, decodeByte(decoder, hi * 16 + lo), limits);
        continue;
      }

      if (!isAlpha(next)) {
        const symbol = String.fromCharCode(next);
        if (!current().skip) appendText(currentCell, CONTROL_SYMBOLS[symbol] ?? "", limits);
        continue;
      }

      let word = String.fromCharCode(next);
      while (i + 1 < bytes.length && isAlpha(bytes[i + 1])) {
        word += String.fromCharCode(bytes[++i]);
      }

      let sign = 1;
      if (bytes[i + 1] === 45) {
        sign = -1;
        i++;
      }
      let hasParam = false;
      let param = 0;
      while (i + 1 < bytes.length && isDigit(bytes[i + 1])) {
        hasParam = true;
        param = param * 10 + (bytes[++i] - 48);
      }
      param *= sign;
      if (bytes[i + 1] === 32) i++;

      if (word === "bin" && hasParam) {
        const n = Math.max(0, param);
        i += n;
        skippedBinaryBytes += n;
        continue;
      }

      if (word === "uc" && hasParam) {
        setCurrent({ uc: Math.max(0, param) });
        continue;
      }

      if (DESTINATIONS_TO_SKIP.has(word)) {
        setCurrent({ skip: true });
        continue;
      }

      if (current().skip) continue;

      if (word === "u" && hasParam) {
        const code = param < 0 ? param + 65536 : param;
        appendText(currentCell, String.fromCharCode(code), limits);
        i += current().uc;
        continue;
      }

      if (word === "cell") {
        pushCell(row, currentCell, limits);
        continue;
      }
      if (word === "row") {
        if (currentCell.length > 0 || row.length > 0) {
          if (currentCell.length > 0) pushCell(row, currentCell, limits);
          pushRow(rows, row, limits);
        }
        continue;
      }
      if (word === "line" || word === "par") {
        appendText(currentCell, "\n", limits);
      }
      continue;
    }

    if (!state.skip) {
      if (byte === 13 || byte === 10) continue;
      appendText(currentCell, decodeByte(decoder, byte), limits);
    }
  }

  if (currentCell.length > 0) pushCell(row, currentCell, limits);
  if (row.length > 0) pushRow(rows, row, limits);

  return {
    rows,
    stats: {
      rowCount: rows.length,
      maxCellsInRow: rows.reduce((max, cells) => Math.max(max, cells.length), 0),
      skippedBinaryBytes,
    },
  };
}
