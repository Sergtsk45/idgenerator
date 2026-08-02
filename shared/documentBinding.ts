export const QUALITY_BINDING_ROLES = ["quality", "passport", "protocol"] as const;

export function isQualityBindingRole(role: string | null | undefined): boolean {
  return QUALITY_BINDING_ROLES.some((qualityRole) => qualityRole === role);
}

export type AttachableQualityDocumentType = "certificate" | "declaration" | "passport" | "protocol";

export function bindingRoleFromDocType(docType: AttachableQualityDocumentType): "quality" | "passport" | "protocol" {
  if (docType === "passport") return "passport";
  if (docType === "protocol") return "protocol";
  return "quality";
}

export function resolveQualityDocumentId(
  bindings: Array<{
    documentId: number | string;
    bindingRole?: string | null;
    useInActs?: boolean | null;
    isPrimary?: boolean | null;
  }>,
): number | null {
  const qualityBindings = bindings.filter((binding) => isQualityBindingRole(binding.bindingRole));
  const binding =
    qualityBindings.find((item) => item.isPrimary && item.useInActs) ??
    qualityBindings.find((item) => item.useInActs) ??
    qualityBindings[0];
  const documentId = Number(binding?.documentId);
  return Number.isFinite(documentId) && documentId > 0 ? documentId : null;
}
