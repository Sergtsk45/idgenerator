/**
 * @file: workPositionKind.ts
 * @description: Классификация позиций ВОР на основные (задачи Ганта) и вспомогательные (подстроки)
 * @dependencies: none
 * @created: 2026-07-29
 */

/**
 * Основная позиция ВОР → задача графика (schedule_tasks).
 * Критерии (в порядке приоритета):
 * - lineNo: целое → main, дробное → auxiliary;
 * - code: ГЭСН / ФЕР / ТЕР (префикс) → main;
 * - code: ФССЦ / ФСБЦ / Цена (префикс) → auxiliary;
 * - code: целый номер (`1`, `10`) → main;
 * - code: дробный иерархический (`10.1`, `10.2`) → auxiliary;
 * - прочий непустой code → main (не теряем неизвестные строки).
 */
export function isMainWorkPosition(work: {
  code?: string | null;
  lineNo?: string | null;
}): boolean {
  const lineNo = String(work.lineNo ?? "").trim();
  if (lineNo) {
    if (/^\d+$/.test(lineNo)) return true;
    if (/^\d+\.\d+/.test(lineNo)) return false;
  }

  const code = String(work.code ?? "").trim();
  if (!code) return false;

  const upper = code.toUpperCase();
  if (upper.startsWith("ГЭСН") || upper.startsWith("ФЕР") || upper.startsWith("ТЕР")) {
    return true;
  }
  if (upper.startsWith("ФССЦ") || upper.startsWith("ФСБЦ")) {
    return false;
  }
  if (upper.startsWith("ЦЕНА")) {
    return false;
  }

  if (/^\d+$/.test(code)) return true;
  if (/^\d+(?:\.\d+)+$/.test(code)) return false;

  return true;
}

/** Группирует вспомогательные позиции ВОР под id последней основной (порядок списка = порядок обхода). */
export function groupAuxiliaryWorksByMainId<
  T extends { id: number; code?: string | null; lineNo?: string | null },
>(worksList: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  let currentMainId: number | null = null;

  for (const work of worksList) {
    if (isMainWorkPosition(work)) {
      currentMainId = work.id;
      if (!map.has(currentMainId)) {
        map.set(currentMainId, []);
      }
    } else if (currentMainId !== null) {
      const list = map.get(currentMainId) ?? [];
      list.push(work);
      map.set(currentMainId, list);
    }
  }

  return map;
}

/** Стабильный порядок ВОР: orderIndex, затем code (numeric). */
export function compareWorksOrder(
  a: { orderIndex?: number | null; code?: string | null },
  b: { orderIndex?: number | null; code?: string | null }
): number {
  const oi = Number(a.orderIndex ?? 0) - Number(b.orderIndex ?? 0);
  if (oi !== 0) return oi;
  return String(a.code ?? "").localeCompare(String(b.code ?? ""), undefined, { numeric: true });
}
