export type EstimateResourceCategory = "labor" | "material" | "equipment" | "unclassified";

export interface EstimatePositionResourceLike {
  resourceType?: string | null;
  unit?: string | null;
  quantity?: unknown;
  quantityTotal?: unknown;
}

/** Estimate positions use stricter rules than generic BoQ rows. */
export function isMainEstimatePosition(position: { code?: string | null }): boolean {
  const code = String(position.code ?? "").trim().toUpperCase();
  return code.startsWith("ГЭСН") || code.startsWith("ФЕР") || code.startsWith("ТЕР");
}

export function normalizeEstimateResourceType(resourceType: unknown): EstimateResourceCategory {
  const normalized = String(resourceType ?? "")
    .toUpperCase()
    .replace(/[()]/g, "")
    .trim();

  if (normalized === "ОТ" || normalized === "ОТМ") return "labor";
  if (normalized === "М") return "material";
  if (normalized === "ЭМ") return "equipment";
  return "unclassified";
}

export function parseEstimateNumeric(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isManHourUnit(unit: unknown): boolean {
  const normalized = String(unit ?? "").toLowerCase().replace(/\s+/g, "").replace(/\./g, "");
  return /^(?:чел(?:-?ч|-?час(?:а|ов)?)|человеко-?час(?:а|ов)?)$/.test(normalized);
}

/** Uses explicit labor types first; untyped man-hour rows are only a fallback. */
export function getEstimatePositionLaborResources<T extends EstimatePositionResourceLike>(resources: readonly T[]): T[] {
  const typedLabor = resources.filter(
    (resource) => normalizeEstimateResourceType(resource.resourceType) === "labor" && isManHourUnit(resource.unit),
  );
  return typedLabor.length > 0
    ? typedLabor
    : resources.filter((resource) => resource.resourceType == null && isManHourUnit(resource.unit));
}

export function getEstimatePositionLaborHours(resources: readonly EstimatePositionResourceLike[]): number | null {
  const total = getEstimatePositionLaborResources(resources).reduce(
    (sum, resource) => {
      const value = parseEstimateNumeric(resource.quantityTotal ?? resource.quantity);
      return sum + (value !== null && value > 0 ? value : 0);
    },
    0,
  );
  return total > 0 ? total : null;
}
