import type { ExecutionWorkflow } from "@shared/schema";

import { db } from "../db";
import type { McpAuthContext } from "../mcp/authContext";
import { MCP_ERROR_CODES, McpToolError } from "../mcp/errors";
import * as actRepo from "./acts/actRepository";
import {
  evaluateActsReadiness,
} from "./acts/actsReadinessCore";
import type { DbClient } from "./execution-workflow/workflowRepository";
import { loadOwnedWorkflow } from "./execution-workflow/workflowService";
import { getMissingQualityDocumentsWithClient } from "./materialRegisterService";
import { listMaterialRegisterItems } from "./material-register/materialRegisterRepository";

/** Hydrates the pure readiness evaluator from one already-owned workflow. */
export async function checkActsReadinessWithClient(client: DbClient, workflow: ExecutionWorkflow) {
  if (!workflow.scheduleId) {
    throw new McpToolError(MCP_ERROR_CODES.ACTS_NOT_READY, "Workflow has no approved schedule", {
      recoverable: true,
    });
  }
  const schedule = await actRepo.getSchedule(client, workflow.scheduleId);
  if (!schedule || schedule.objectId !== workflow.objectId) {
    throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Workflow schedule not found");
  }

  const tasks = await actRepo.listScheduleTasks(client, schedule.id);
  const [materials, missingQuality, sourceData, registerItems] = await Promise.all([
    actRepo.listTaskMaterials(client, tasks.map((task) => task.id)),
    getMissingQualityDocumentsWithClient(client, workflow),
    actRepo.loadActSourceFieldPresence(client, workflow.objectId),
    listMaterialRegisterItems(client, workflow.id),
  ]);
  const fallbackDocuments = await actRepo.qualityDocumentFallbacks(
    client,
    Array.from(new Set(materials.map((material) => Number(material.projectMaterialId)))),
  );
  const referencesValid = await actRepo.explicitQualityDocumentsAreValid(client, materials, workflow.objectId);
  const registerMaterialIds = new Set(registerItems.filter((item) => item.active).map((item) => item.projectMaterialId));
  const manualMissing = new Map<number, Set<number>>();
  // ponytail: one corrupt legacy reference conservatively flags all explicit references;
  // return per-row validation results if precise repair prompts become necessary.
  for (const material of materials) {
    const materialId = Number(material.projectMaterialId);
    const suspectReference = !referencesValid && (material.qualityDocumentId !== null || material.batchId !== null);
    if (!suspectReference && (registerMaterialIds.has(materialId) || material.qualityDocumentId !== null || fallbackDocuments.has(materialId))) continue;
    const taskIds = manualMissing.get(materialId) ?? new Set<number>();
    taskIds.add(material.taskId);
    manualMissing.set(materialId, taskIds);
  }
  const taskIdsWithMaterials = new Set(materials.map((material) => material.taskId));
  const readiness = evaluateActsReadiness({
    scheduleId: schedule.id,
    tasks: tasks.map((task) => ({
      id: task.id,
      actNumber: task.actNumber,
      actTemplateId: task.actTemplateId,
      startDate: task.startDate,
      durationDays: task.durationDays,
      workId: task.workId,
      estimatePositionId: task.estimatePositionId,
      projectDrawings: task.projectDrawings,
      normativeRefs: task.normativeRefs,
      executiveSchemes: Array.isArray(task.executiveSchemes)
        ? task.executiveSchemes.map((scheme) => ({ title: String(scheme?.title ?? "") }))
        : null,
      hasMaterials: taskIdsWithMaterials.has(task.id),
    })),
    missingQualityRequirements: missingQuality.missingRequirements.map((requirement) => ({
      projectMaterialId: requirement.projectMaterialId,
      ruleId: requirement.ruleId,
      reason: requirement.reason,
      acceptableDocTypes: requirement.acceptableDocTypes,
      usedInTaskIds: requirement.usedInTaskIds,
    })).concat(Array.from(manualMissing, ([projectMaterialId, taskIds]) => ({
      projectMaterialId,
      ruleId: "manual-material-quality-document",
      reason: "Для материала задачи не указан действующий документ качества",
      acceptableDocTypes: ["certificate", "declaration", "passport", "protocol"],
      usedInTaskIds: Array.from(taskIds).sort((left, right) => left - right),
    }))),
    materialClassificationIssues: missingQuality.blockingIssues.map((issue) => ({
      registerItemId: issue.registerItemId,
      reason: issue.reason,
    })),
    sourceData: {
      objectId: workflow.objectId,
      fields: sourceData,
    },
  });

  return {
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    stage: workflow.stage,
    scheduleId: schedule.id,
    ...readiness,
  };
}

export async function checkActsReadiness(auth: McpAuthContext, workflowId: number) {
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);
  return checkActsReadinessWithClient(db, workflow);
}
