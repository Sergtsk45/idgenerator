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

/** Группирует auxiliary под numeric parent или предыдущую main-позицию в той же коллекции. */
export function groupAuxiliaryWorksByMainId<
  T extends {
    id: number;
    workCollectionId?: number | null;
    code?: string | null;
    lineNo?: string | null;
  },
>(worksList: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  const currentMainIdByCollection = new Map<number | null, number>();
  const mainIdByCollectionAndCode = new Map<string, number>();

  const hierarchyCode = (work: T): string | null => {
    const lineNo = String(work.lineNo ?? "").trim();
    if (/^\d+(?:\.\d+)*$/.test(lineNo)) return lineNo;
    const code = String(work.code ?? "").trim();
    return /^\d+(?:\.\d+)*$/.test(code) ? code : null;
  };
  const hierarchyKey = (collectionId: number | null, code: string) =>
    `${collectionId ?? "none"}:${code}`;

  for (const work of worksList) {
    const collectionId = work.workCollectionId ?? null;
    if (isMainWorkPosition(work)) {
      currentMainIdByCollection.set(collectionId, work.id);
      const code = hierarchyCode(work);
      if (code) {
        mainIdByCollectionAndCode.set(hierarchyKey(collectionId, code), work.id);
      }
      if (!map.has(work.id)) map.set(work.id, []);
      continue;
    }

    const code = hierarchyCode(work);
    const parentCode = code?.includes(".") ? code.slice(0, code.indexOf(".")) : null;
    const parentId = parentCode
      ? mainIdByCollectionAndCode.get(hierarchyKey(collectionId, parentCode))
      : currentMainIdByCollection.get(collectionId);

    if (parentId !== undefined) {
      const list = map.get(parentId) ?? [];
      list.push(work);
      map.set(parentId, list);
    }
  }

  return map;
}

/** Стабильный порядок ВОР: коллекция, локальный orderIndex, code (numeric), id. */
export function compareWorksOrder(
  a: { id?: number | null; workCollectionId?: number | null; orderIndex?: number | null; code?: string | null },
  b: { id?: number | null; workCollectionId?: number | null; orderIndex?: number | null; code?: string | null }
): number {
  const collection =
    Number(a.workCollectionId ?? 0) - Number(b.workCollectionId ?? 0);
  if (collection !== 0) return collection;
  const oi = Number(a.orderIndex ?? 0) - Number(b.orderIndex ?? 0);
  if (oi !== 0) return oi;
  const code = String(a.code ?? "").localeCompare(String(b.code ?? ""), undefined, {
    numeric: true,
  });
  if (code !== 0) return code;
  return Number(a.id ?? 0) - Number(b.id ?? 0);
}
