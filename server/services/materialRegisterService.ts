import { createHash } from "node:crypto";

import type { ExecutionWorkflow, MaterialRegisterClassification, WorkflowStage } from "@shared/schema";
import { isQualityBindingRole } from "@shared/documentBinding";
import { db } from "../db";
import type { McpAuthContext } from "../mcp/authContext";
import { MCP_ERROR_CODES, McpToolError } from "../mcp/errors";
import { loadAnalysisSource, loadCurrentEstimateAnalysis } from "./estimate-analysis/currentEstimateAnalysis";
import type { DbClient } from "./execution-workflow/workflowRepository";
import * as workflowRepo from "./execution-workflow/workflowRepository";
import { loadOwnedWorkflow, withIdempotency } from "./execution-workflow/workflowService";
import {
  MATERIAL_REGISTER_RULES_VERSION,
  MATERIAL_CATEGORIES,
  MATERIAL_REQUIREMENT_RULES,
  buildMaterialRegisterDraft,
  normalizeMaterialName,
  normalizeMaterialUnit,
  type MaterialCategory,
  type MaterialRegisterSourceInput,
} from "./material-register/materialRegisterCore";
import * as registerRepo from "./material-register/materialRegisterRepository";
import { getScheduleById } from "./schedule-planning/scheduleDraftRepository";

function registerHash(analysisInputHash: string, scheduleId: number, tasks: Array<{ id: number; estimatePositionId: number | null }>) {
  return createHash("sha256").update(JSON.stringify({
    analysisInputHash,
    rulesVersion: MATERIAL_REGISTER_RULES_VERSION,
    scheduleId,
    tasks: tasks.map((task) => [task.id, task.estimatePositionId]),
  })).digest("hex");
}

async function loadBuildContext(client: DbClient, workflow: ExecutionWorkflow) {
  if (!workflow.estimateId || !workflow.scheduleId) {
    throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_NOT_READY, "Approved estimate schedule is required", { recoverable: true });
  }
  const analysis = await loadCurrentEstimateAnalysis(client, workflow);
  if (!analysis) {
    throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_STALE, "Estimate analysis is missing or stale", { recoverable: true });
  }
  const schedule = await getScheduleById(client, workflow.scheduleId);
  if (!schedule || schedule.objectId !== workflow.objectId || schedule.estimateId !== workflow.estimateId) {
    throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_STALE, "Approved schedule linkage is stale", { recoverable: true });
  }
  const tasks = await registerRepo.listScheduleTasksForMaterialRegister(client, schedule.id);
  const taskPositionIds = new Set(tasks
    .map((task) => task.estimatePositionId)
    .filter((id): id is number => id !== null));
  const mainPositionIds = new Set(analysis.mainWorks.map((work) => work.positionId));
  if (tasks.length !== mainPositionIds.size
    || taskPositionIds.size !== tasks.length
    || taskPositionIds.size !== mainPositionIds.size
    || Array.from(mainPositionIds).some((positionId) => !taskPositionIds.has(positionId))) {
    throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_STALE, "Approved schedule tasks no longer match main estimate positions", {
      recoverable: true,
    });
  }
  return { analysis, schedule, tasks, inputHash: registerHash(analysis.inputHash, schedule.id, tasks) };
}

async function sourceInputs(client: DbClient, workflow: ExecutionWorkflow, context: Awaited<ReturnType<typeof loadBuildContext>>) {
  const hydrated = await loadAnalysisSource(client, workflow);
  const candidateResourceIds = new Set([
    ...context.analysis.materialCandidates.filter((ref) => ref.sourceType === "resource").map((ref) => ref.sourceId),
    ...context.analysis.equipmentCandidates.filter((ref) => ref.sourceType === "resource").map((ref) => ref.sourceId),
    ...context.analysis.unclassifiedResources.map((ref) => ref.sourceId),
  ]);
  const candidatePositionIds = new Set(context.analysis.materialCandidates
    .filter((ref) => ref.sourceType === "position")
    .map((ref) => ref.sourceId));
  const existingItems = await registerRepo.listMaterialRegisterItems(client, workflow.id, { activeOnly: false });
  const itemById = new Map(existingItems.map((item) => [item.id, item]));
  const existingSources = await registerRepo.listMaterialRegisterSourceLinks(client, workflow.id);
  const itemByResourceId = new Map(existingSources
    .filter((source) => source.positionResourceId !== null)
    .map((source) => [source.positionResourceId!, itemById.get(source.itemId)]));
  const itemByPositionId = new Map(existingSources
    .filter((source) => source.positionResourceId === null)
    .map((source) => [source.estimatePositionId, itemById.get(source.itemId)]));
  const taskByPosition = new Map(context.tasks
    .filter((task) => task.estimatePositionId !== null)
    .map((task) => [task.estimatePositionId!, task]));
  const taskIdBySource = new Map<string, number | null>();
  const sources: MaterialRegisterSourceInput[] = [];

  for (const section of hydrated.sections) {
    let currentTaskId: number | null = null;
    for (const position of section.positions) {
      const directTask = taskByPosition.get(position.id);
      if (directTask) currentTaskId = directTask.id;
      if (candidatePositionIds.has(position.id)) {
        const oldItem = itemByPositionId.get(position.id);
        sources.push({
          sourceType: "position",
          sourceId: position.id,
          estimateId: workflow.estimateId!,
          estimatePositionId: position.id,
          resourceCode: position.code,
          name: position.name,
          unit: position.unit,
          quantity: position.quantity,
          manualClassification: oldItem?.classificationMethod === "manual" ? oldItem.classification : null,
        });
        taskIdBySource.set(`position:${position.id}`, currentTaskId);
      }
      for (const resource of position.resources) {
        if (!candidateResourceIds.has(resource.id)) continue;
        const oldItem = itemByResourceId.get(resource.id);
        sources.push({
          sourceType: "resource",
          sourceId: resource.id,
          estimateId: workflow.estimateId!,
          estimatePositionId: position.id,
          resourceType: resource.resourceType,
          resourceCode: resource.resourceCode,
          name: resource.name,
          unit: resource.unit,
          quantity: resource.quantityTotal ?? resource.quantity,
          manualClassification: oldItem?.classificationMethod === "manual" ? oldItem.classification : null,
        });
        taskIdBySource.set(`resource:${resource.id}`, currentTaskId);
      }
    }
  }
  return { draft: buildMaterialRegisterDraft(sources), existingItems, existingSources, taskIdBySource };
}

function requirementsFor(category: MaterialCategory) {
  return MATERIAL_REQUIREMENT_RULES
    .filter((rule) => rule.category === category)
    .flatMap((rule) => rule.acceptableDocTypes.map((documentType) => ({
      ruleId: rule.ruleId,
      documentType,
      reason: rule.reason,
    })));
}

function classificationReason(method: string, ruleId: string | null) {
  if (method === "manual") return "Classification was confirmed or corrected manually";
  if (method === "resource_type") return "Estimate resource type explicitly identifies this category";
  if (method === "rule") return `Conservative classification rule matched: ${ruleId ?? "unknown"}`;
  return "No supported explicit resource type or narrow classification rule matched";
}

async function readRegister(client: DbClient, workflow: ExecutionWorkflow) {
  const state = await registerRepo.getMaterialRegisterState(client, workflow.id);
  if (!state) throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_NOT_FOUND, "Material register not found");
  const items = await registerRepo.listMaterialRegisterItems(client, workflow.id);
  const sources = await registerRepo.listMaterialRegisterSourceLinks(client, workflow.id);
  const requirements = await registerRepo.listMaterialRegisterRequirements(client, items.map((item) => item.id));
  const projectMaterials = await registerRepo.listActiveProjectMaterials(client, workflow.objectId);
  const materialById = new Map(projectMaterials.map((material) => [material.id, material]));
  const sourcesByItem = new Map<number, typeof sources>();
  for (const source of sources) {
    const list = sourcesByItem.get(source.itemId) ?? [];
    list.push(source);
    sourcesByItem.set(source.itemId, list);
  }
  const rulesByItem = new Map<number, Map<string, { ruleId: string; reason: string; acceptableDocTypes: string[] }>>();
  for (const requirement of requirements) {
    const byRule = rulesByItem.get(requirement.itemId) ?? new Map();
    const rule = byRule.get(requirement.ruleId) ?? { ruleId: requirement.ruleId, reason: requirement.reason, acceptableDocTypes: [] };
    rule.acceptableDocTypes.push(requirement.documentType);
    byRule.set(requirement.ruleId, rule);
    rulesByItem.set(requirement.itemId, byRule);
  }
  const resultItems = items.map((item) => {
    const material = materialById.get(item.projectMaterialId);
    const itemSources = sourcesByItem.get(item.id) ?? [];
    return {
      registerItemId: item.id,
      projectMaterialId: item.projectMaterialId,
      name: material?.nameOverride ?? item.normalizedName,
      unit: material?.baseUnitOverride ?? item.normalizedUnit,
      normalizedName: item.normalizedName,
      normalizedUnit: item.normalizedUnit,
      classification: {
        category: item.classification,
        method: item.classificationMethod,
        confidence: item.confidence,
        confirmed: item.confirmed,
        ruleId: item.classificationRuleId,
        reason: classificationReason(item.classificationMethod, item.classificationRuleId),
      },
      sourceLinks: itemSources.map((source) => ({
        estimateResourceId: source.positionResourceId,
        sourceType: source.sourceType,
        sourceId: source.positionResourceId ?? source.estimatePositionId,
        estimatePositionId: source.estimatePositionId,
        scheduleTaskId: source.scheduleTaskId,
        sourceName: source.sourceName,
        sourceUnit: source.sourceUnit,
        sourceQuantity: source.sourceQuantity,
      })),
      requirements: Array.from(rulesByItem.get(item.id)?.values() ?? []),
    };
  });
  const blockingIssues = resultItems
    .filter((item) => item.classification.category === "unclassified")
    .map((item) => ({
      code: "MATERIAL_CLASSIFICATION_REQUIRED" as const,
      blocking: true as const,
      registerItemId: item.registerItemId,
      reason: "Classification must be confirmed before automatic final completeness",
    }));
  return {
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    stage: workflow.stage,
    inputHash: state.inputHash,
    rulesVersion: state.rulesVersion,
    items: resultItems,
    blockingIssues,
    ready: blockingIssues.length === 0,
  };
}

export async function buildMaterialRegister(
  auth: McpAuthContext,
  args: { workflowId: number; expectedVersion: number; idempotencyKey: string },
) {
  return withIdempotency(auth.userId, "build_material_register", args.idempotencyKey, {
    workflowId: args.workflowId,
    expectedVersion: args.expectedVersion,
  }, async (tx) => {
    const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
    if (workflow.version !== args.expectedVersion) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });
    }
    if (!(["schedule_approved", "materials_register_ready"] as WorkflowStage[]).includes(workflow.stage)) {
      throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_NOT_READY, "Workflow is not ready for material register", { recoverable: true });
    }
    const context = await loadBuildContext(tx, workflow);
    const state = await registerRepo.getMaterialRegisterState(tx, workflow.id);
    if (state?.inputHash === context.inputHash
      && state.rulesVersion === String(MATERIAL_REGISTER_RULES_VERSION)
      && workflow.stage === "materials_register_ready") {
      const persistedItems = await registerRepo.listMaterialRegisterItems(tx, workflow.id);
      const activeProjectMaterialIds = new Set(
        (await registerRepo.listActiveProjectMaterials(tx, workflow.objectId)).map((material) => material.id),
      );
      const persistedItemById = new Map(persistedItems.map((item) => [item.id, item]));
      const persistedSources = await registerRepo.listMaterialRegisterSourceLinks(tx, workflow.id);
      const desired = persistedSources.flatMap((source) => {
        const item = persistedItemById.get(source.itemId);
        return item && source.scheduleTaskId !== null
          ? [{ taskId: source.scheduleTaskId, projectMaterialId: item.projectMaterialId }]
          : [];
      });
      if (persistedItems.every((item) => activeProjectMaterialIds.has(item.projectMaterialId))
        && await registerRepo.generatedTaskMaterialLinksMatch(tx, context.schedule.id, desired)) {
        return readRegister(tx, workflow);
      }
    }
    const nextStage: WorkflowStage = "materials_register_ready";
    const updated = workflow.stage === nextStage
      ? await workflowRepo.touchWorkflowIfVersionMatches(tx, workflow.id, args.expectedVersion)
      : await workflowRepo.updateWorkflowStageIfVersionMatches(tx, workflow.id, args.expectedVersion, nextStage);
    if (!updated) throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });

    const materialData = await sourceInputs(tx, workflow, context);
    const oldItemById = new Map(materialData.existingItems.map((item) => [item.id, item]));
    const oldItemIdsBySource = new Map<string, number>();
    for (const source of materialData.existingSources) {
      const sourceId = source.positionResourceId ?? source.estimatePositionId;
      oldItemIdsBySource.set(`${source.sourceType}:${sourceId}`, source.itemId);
    }
    const activeItemIds: number[] = [];
    const activeLinkIds: number[] = [];
    const desiredTaskLinks: Array<{ taskId: number; projectMaterialId: number }> = [];
    const claimedExistingItemIds = new Set<number>();
    const claimedProjectMaterialIds = new Set<number>();
    const activeProjectMaterials = await registerRepo.listActiveProjectMaterials(tx, workflow.objectId);
    const activeProjectMaterialIds = new Set(activeProjectMaterials.map((material) => material.id));
    const registeredProjectMaterialIds = new Set(materialData.existingItems.map((item) => item.projectMaterialId));

    for (const draftItem of materialData.draft.items) {
      const linkedItemsAll = draftItem.sources
        .map((source) => oldItemById.get(oldItemIdsBySource.get(`${source.sourceType}:${source.sourceId}`) ?? -1))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      const linkedItems = linkedItemsAll.filter((item) => activeProjectMaterialIds.has(item.projectMaterialId));
      const fingerprintItem = await registerRepo.findMaterialRegisterItemByFingerprint(tx, workflow.id, draftItem.dedupKey);
      let existing = linkedItems.find((item) => item.classificationMethod === "manual" && !claimedExistingItemIds.has(item.id))
        ?? (fingerprintItem
          && activeProjectMaterialIds.has(fingerprintItem.projectMaterialId)
          && !claimedExistingItemIds.has(fingerprintItem.id) ? fingerprintItem : undefined)
        ?? linkedItems.find((item) => !claimedExistingItemIds.has(item.id));
      const orphanedItem = existing ? undefined : linkedItemsAll.find((item) =>
        !activeProjectMaterialIds.has(item.projectMaterialId) && !claimedExistingItemIds.has(item.id))
        ?? (fingerprintItem
          && !activeProjectMaterialIds.has(fingerprintItem.projectMaterialId)
          && !claimedExistingItemIds.has(fingerprintItem.id) ? fingerprintItem : undefined);
      const exactProjectMaterials = activeProjectMaterials.filter((material) =>
        !registeredProjectMaterialIds.has(material.id)
        && !claimedProjectMaterialIds.has(material.id)
        && Boolean(material.nameOverride?.trim())
        && normalizeMaterialName(material.nameOverride!) === draftItem.normalizedName
        && normalizeMaterialUnit(material.baseUnitOverride) === draftItem.normalizedUnit);
      const reusableProjectMaterial = exactProjectMaterials.length === 1 ? exactProjectMaterials[0] : undefined;
      const projectMaterial = existing
        ? { id: existing.projectMaterialId }
        : reusableProjectMaterial
          ? reusableProjectMaterial
        : await registerRepo.createGeneratedProjectMaterial(tx, {
            objectId: workflow.objectId,
            name: draftItem.displayName || "Без названия",
            unit: draftItem.displayUnit,
          });
      claimedProjectMaterialIds.add(projectMaterial.id);
      if (orphanedItem) {
        existing = await registerRepo.replaceMaterialRegisterItemProjectMaterial(
          tx,
          workflow.id,
          orphanedItem.id,
          projectMaterial.id,
        );
      }
      if (existing) claimedExistingItemIds.add(existing.id);
      const generatedMethod = draftItem.classification.method === "manual" ? "unclassified" : draftItem.classification.method;
      const item = await registerRepo.upsertGeneratedMaterialRegisterItem(tx, {
        workflowId: workflow.id,
        projectMaterialId: projectMaterial.id,
        fingerprint: draftItem.dedupKey,
        normalizedName: draftItem.normalizedName,
        normalizedUnit: draftItem.normalizedUnit,
        classification: draftItem.classification.category,
        classificationMethod: generatedMethod,
        confidence: draftItem.classification.confidence,
        confirmed: draftItem.classification.confirmed,
        classificationRuleId: draftItem.classification.ruleId,
      });
      if (draftItem.classification.method === "manual" && item.classificationMethod !== "manual") {
        await registerRepo.confirmMaterialRegisterClassification(tx, {
          workflowId: workflow.id,
          itemId: item.id,
          classification: draftItem.classification.category,
        });
      }
      const effectiveItem = await registerRepo.getMaterialRegisterItem(tx, workflow.id, item.id) ?? item;
      activeItemIds.push(effectiveItem.id);
      await registerRepo.replaceMaterialRegisterRequirements(tx, effectiveItem.id, requirementsFor(effectiveItem.classification));
      for (const source of draftItem.sources) {
        const scheduleTaskId = materialData.taskIdBySource.get(`${source.sourceType}:${source.sourceId}`) ?? null;
        const link = await registerRepo.upsertMaterialRegisterSourceLink(tx, {
          workflowId: workflow.id,
          itemId: effectiveItem.id,
          estimateId: source.estimateId,
          estimatePositionId: source.estimatePositionId,
          positionResourceId: source.sourceType === "resource" ? source.sourceId : null,
          scheduleTaskId,
          sourceType: source.sourceType,
          sourceName: source.sourceName,
          sourceUnit: source.sourceUnit,
          sourceQuantity: source.normalizedQuantity === null ? null : String(source.normalizedQuantity),
          normalizedName: source.normalizedName,
          normalizedUnit: source.normalizedUnit,
        });
        activeLinkIds.push(link.id);
        if (scheduleTaskId !== null) desiredTaskLinks.push({ taskId: scheduleTaskId, projectMaterialId: effectiveItem.projectMaterialId });
      }
    }
    await registerRepo.deleteMaterialRegisterSourceLinksExcept(tx, workflow.id, activeLinkIds);
    await registerRepo.deactivateMaterialRegisterItemsExcept(tx, workflow.id, activeItemIds);
    await registerRepo.reconcileGeneratedTaskMaterialLinks(tx, context.schedule.id, desiredTaskLinks);
    await registerRepo.upsertMaterialRegisterState(tx, {
      workflowId: workflow.id,
      estimateId: workflow.estimateId!,
      inputHash: context.inputHash,
      rulesVersion: String(MATERIAL_REGISTER_RULES_VERSION),
    });
    if (workflow.stage !== nextStage) {
      await workflowRepo.insertWorkflowEvent(tx, {
        workflowId: workflow.id,
        eventType: "stage_transition",
        actorType: "system",
        actorId: null,
        payloadJson: { from: workflow.stage, to: nextStage },
      });
    }
    await workflowRepo.insertWorkflowEvent(tx, {
      workflowId: workflow.id,
      eventType: "material_register_built",
      actorType: "agent",
      actorId: String(auth.userId),
      payloadJson: { inputHash: context.inputHash, itemsCount: activeItemIds.length },
    });
    return readRegister(tx, updated);
  });
}

export async function getMaterialRegister(auth: McpAuthContext, workflowId: number) {
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);
  const state = await registerRepo.getMaterialRegisterState(db, workflow.id);
  if (!state) throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_NOT_FOUND, "Material register not found");
  const context = await loadBuildContext(db, workflow);
  if (state.inputHash !== context.inputHash || state.rulesVersion !== String(MATERIAL_REGISTER_RULES_VERSION)) {
    throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_STALE, "Material register is stale", { recoverable: true });
  }
  const [items, activeProjectMaterials] = await Promise.all([
    registerRepo.listMaterialRegisterItems(db, workflow.id),
    registerRepo.listActiveProjectMaterials(db, workflow.objectId),
  ]);
  const activeProjectMaterialIds = new Set(activeProjectMaterials.map((material) => material.id));
  if (items.some((item) => !activeProjectMaterialIds.has(item.projectMaterialId))) {
    throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_STALE, "Material register references a deleted project material", {
      recoverable: true,
    });
  }
  return readRegister(db, workflow);
}

export async function confirmMaterialClassification(
  auth: McpAuthContext,
  args: {
    workflowId: number;
    registerItemId: number;
    classification: MaterialRegisterClassification;
    expectedVersion: number;
    idempotencyKey: string;
  },
) {
  if (!MATERIAL_CATEGORIES.includes(args.classification)) {
    throw new McpToolError(MCP_ERROR_CODES.VALIDATION_ERROR, `Unsupported material classification "${args.classification}"`);
  }
  return withIdempotency(auth.userId, "confirm_material_classification", args.idempotencyKey, {
    workflowId: args.workflowId,
    registerItemId: args.registerItemId,
    classification: args.classification,
    expectedVersion: args.expectedVersion,
  }, async (tx) => {
    const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
    if (workflow.version !== args.expectedVersion) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });
    }
    if (workflow.stage !== "materials_register_ready") {
      throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_NOT_READY, "Material register is not ready", { recoverable: true });
    }
    const item = await registerRepo.getMaterialRegisterItem(tx, workflow.id, args.registerItemId);
    if (!item || !item.active) throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_NOT_FOUND, "Material register item not found");
    if (item.classificationMethod === "manual" && item.classification === args.classification && item.confirmed) {
      return readRegister(tx, workflow);
    }
    const updatedWorkflow = await workflowRepo.touchWorkflowIfVersionMatches(tx, workflow.id, args.expectedVersion);
    if (!updatedWorkflow) throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });
    const updatedItem = await registerRepo.confirmMaterialRegisterClassification(tx, {
      workflowId: workflow.id,
      itemId: item.id,
      classification: args.classification,
    });
    if (!updatedItem) throw new McpToolError(MCP_ERROR_CODES.MATERIAL_REGISTER_NOT_FOUND, "Material register item not found");
    await registerRepo.replaceMaterialRegisterRequirements(tx, item.id, requirementsFor(args.classification));
    await workflowRepo.insertWorkflowEvent(tx, {
      workflowId: workflow.id,
      eventType: "material_classification_confirmed",
      actorType: "agent",
      actorId: String(auth.userId),
      payloadJson: { registerItemId: item.id, classification: args.classification },
    });
    return readRegister(tx, updatedWorkflow);
  });
}

export async function getMissingQualityDocuments(auth: McpAuthContext, workflowId: number) {
  const register = await getMaterialRegister(auth, workflowId);
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);
  const matches = await registerRepo.listMaterialRequirementDocumentMatches(db, workflow.id);
  const today = new Date().toISOString().slice(0, 10);
  const byRule = new Map<string, typeof matches>();
  for (const row of matches) {
    const key = `${row.itemId}:${row.ruleId}`;
    const list = byRule.get(key) ?? [];
    list.push(row);
    byRule.set(key, list);
  }
  const missingRequirements = [];
  for (const rows of Array.from(byRule.values())) {
    const satisfied = rows.some((row) => row.documentId !== null
      && row.bindingUseInActs === true
      && isQualityBindingRole(row.bindingRole)
      && (row.documentScope === "global" || row.documentObjectId === workflow.objectId)
      && (row.documentValidFrom === null || row.documentValidFrom <= today)
      && (row.documentValidTo === null || row.documentValidTo >= today));
    if (satisfied) continue;
    const item = register.items.find((candidate) => candidate.registerItemId === rows[0].itemId)!;
    missingRequirements.push({
      registerItemId: rows[0].itemId,
      projectMaterialId: rows[0].projectMaterialId,
      name: item.name,
      ruleId: rows[0].ruleId,
      reason: rows[0].reason,
      acceptableDocTypes: Array.from(new Set(rows.map((row) => row.documentType))),
      usedInTaskIds: Array.from(new Set(item.sourceLinks.map((source) => source.scheduleTaskId).filter((id): id is number => id !== null))).sort((a, b) => a - b),
    });
  }
  return {
    workflowId,
    missingRequirements,
    blockingIssues: register.blockingIssues,
    ready: missingRequirements.length === 0 && register.blockingIssues.length === 0,
    disclaimer: "MVP seed requirements do not assert normative sufficiency and require user verification",
  };
}
