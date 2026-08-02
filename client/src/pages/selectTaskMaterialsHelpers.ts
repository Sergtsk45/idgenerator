/**
 * @file: selectTaskMaterialsHelpers.ts
 * @description: Чистые хелперы добавления созданного материала в локальный список задачи.
 * @dependencies: materialWizardResult
 * @created: 2026-08-02
 */

import type { CreatedMaterialResult } from "@/components/materials/materialWizardResult";

export type TaskMaterialItem = {
  projectMaterialId: number;
  batchId: number | null;
  qualityDocumentId: number | null;
  note: string | null;
};

export function appendCreatedMaterial(
  materials: TaskMaterialItem[],
  result: CreatedMaterialResult,
): TaskMaterialItem[] {
  return [
    ...materials,
    {
      projectMaterialId: result.projectMaterialId,
      batchId: result.batchId,
      qualityDocumentId: result.qualityDocumentId,
      note: null,
    },
  ];
}

export function toReplaceTaskMaterialsPayload(materials: TaskMaterialItem[]) {
  return materials.map((item, index) => ({
    projectMaterialId: item.projectMaterialId,
    batchId: item.batchId,
    qualityDocumentId: item.qualityDocumentId,
    note: item.note,
    orderIndex: index,
  }));
}
