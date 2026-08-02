/**
 * @file: materialWizardResult.ts
 * @description: Тип результата MaterialWizard и чистые хелперы для qualityDocumentId/displayName.
 * @dependencies: @shared/documentBinding
 * @created: 2026-08-02
 */

import { isQualityBindingRole } from "@shared/documentBinding";

export type CreatedMaterialResult = {
  projectMaterialId: number;
  batchId: number | null;
  qualityDocumentId: number | null;
  displayName: string;
};

export type MaterialWizardSource = "catalog" | "new";

/** Роль binding по типу документа (как в MaterialWizard). */
export function bindingRoleFromDocType(docType: string): string {
  if (docType === "passport") return "passport";
  if (docType === "protocol") return "protocol";
  if (docType === "scheme") return "scheme";
  if (docType === "other") return "other";
  return "quality";
}

/**
 * ID документа для строки task_materials: только quality/passport/protocol.
 * scheme/other сохраняются в bindings материала, но в задачу не передаются.
 */
export function qualityDocumentIdForTask(
  documentId: number | null | undefined,
  bindingRole: string | null | undefined,
): number | null {
  const id = Number(documentId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return isQualityBindingRole(bindingRole) ? id : null;
}

export function resolveMaterialDisplayName(params: {
  source: MaterialWizardSource;
  nameOverride?: string | null;
  catalogName?: string | null;
  projectMaterialId: number;
}): string {
  if (params.source === "new") {
    const name = String(params.nameOverride ?? "").trim();
    if (name) return name;
  } else {
    const catalogName = String(params.catalogName ?? "").trim();
    if (catalogName) return catalogName;
    const override = String(params.nameOverride ?? "").trim();
    if (override) return override;
  }
  return `Material #${params.projectMaterialId}`;
}

export function buildCreatedMaterialResult(params: {
  projectMaterialId: number;
  batchId?: number | null;
  documentId?: number | null;
  bindingRole?: string | null;
  source: MaterialWizardSource;
  nameOverride?: string | null;
  catalogName?: string | null;
}): CreatedMaterialResult {
  return {
    projectMaterialId: params.projectMaterialId,
    batchId: params.batchId == null ? null : Number(params.batchId),
    qualityDocumentId: qualityDocumentIdForTask(params.documentId, params.bindingRole),
    displayName: resolveMaterialDisplayName({
      source: params.source,
      nameOverride: params.nameOverride,
      catalogName: params.catalogName,
      projectMaterialId: params.projectMaterialId,
    }),
  };
}
