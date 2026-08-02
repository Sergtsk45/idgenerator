/**
 * @file: p3MaterialsText.ts
 * @description: Grouped AOSR §3 materials text (multi quality docs per material)
 * @dependencies: none
 * @created: 2026-08-01
 */

function translateDocTypeRu(docType: string | null | undefined): string {
  switch (String(docType ?? "")) {
    case "certificate":
      return "Сертификат";
    case "declaration":
      return "Декларация";
    case "passport":
      return "Паспорт";
    case "protocol":
      return "Протокол";
    case "scheme":
      return "Схема";
    default:
      return "Документ";
  }
}

/** Lowercase type + factory/serial number for п.3 prose list. */
export function formatP3DocFragment(docType: string | null | undefined, docNumber: string | null | undefined): string {
  const type = translateDocTypeRu(docType).toLowerCase();
  const num = String(docNumber ?? "").trim();
  if (!num) return type;
  if (/зав\.?\s*№/i.test(num)) return `${type} ${num}`;
  return `${type} зав. №${num}`;
}

export type P3UsageForGrouping = {
  projectMaterialId: number;
  orderIndex?: number | null;
  materialName: string;
  standardRef?: string | null;
  docType?: string | null;
  docNumber?: string | null;
  hasDocument: boolean;
};

/**
 * Group usages by material; list quality docs in one phrase per material.
 * Example: `термометр БиТ-63 паспорт зав. №0091, паспорт зав. №0096`
 */
export function formatP3MaterialsGrouped(usages: P3UsageForGrouping[]): string {
  if (!usages.length) return "";

  type Group = {
    namePart: string;
    firstOrder: number;
    docs: string[];
    seenDocKeys: Set<string>;
    hasAnyDocument: boolean;
  };
  const groups = new Map<number, Group>();

  usages.forEach((u, idx) => {
    const materialId = Number(u.projectMaterialId);
    const name = String(u.materialName ?? "").trim() || `Материал #${materialId}`;
    const standardRef = String(u.standardRef ?? "").trim();
    const namePart = standardRef ? `${name} (${standardRef})` : name;
    const order = u.orderIndex == null ? idx : Number(u.orderIndex);

    let group = groups.get(materialId);
    if (!group) {
      group = {
        namePart,
        firstOrder: order,
        docs: [],
        seenDocKeys: new Set(),
        hasAnyDocument: false,
      };
      groups.set(materialId, group);
    } else {
      group.firstOrder = Math.min(group.firstOrder, order);
    }

    if (!u.hasDocument) return;
    group.hasAnyDocument = true;
    const fragment = formatP3DocFragment(u.docType, u.docNumber);
    const key = fragment.toLowerCase();
    if (group.seenDocKeys.has(key)) return;
    group.seenDocKeys.add(key);
    group.docs.push(fragment);
  });

  return Array.from(groups.values())
    .sort((a, b) => a.firstOrder - b.firstOrder)
    .map((group) => {
      if (!group.hasAnyDocument || group.docs.length === 0) {
        return `${group.namePart} документ качества: не указан`;
      }
      return `${group.namePart} ${group.docs.join(", ")}`;
    })
    .join("; ");
}
