import type { ExecutionWorkflow, Schedule, ScheduleTask, WorkflowStage } from "@shared/schema";

import { db } from "../../db";
import type { McpAuthContext } from "../../mcp/authContext";
import { MCP_ERROR_CODES, McpToolError } from "../../mcp/errors";
import { addDaysISO } from "../../routes/_dateUtils";
import * as workflowRepo from "../execution-workflow/workflowRepository";
import type { DbClient } from "../execution-workflow/workflowRepository";
import { loadOwnedWorkflow, withIdempotency } from "../execution-workflow/workflowService";
import * as repo from "./actRepository";
import { aggregateActSchemes, groupActTasks, mergeActFreeText } from "./actGenerationCore";

export type ActGenerationMode = "draft" | "final";

export interface ActGenerationWarning {
  actNumber: number;
  type: string;
  message: string;
}

export interface ActGenerationResult {
  scheduleId: number;
  actNumbers: number[];
  created: number;
  updated: number;
  skippedNoActNumber: number;
  deletedActNumbers: number[];
  warnings: ActGenerationWarning[];
  acts: Array<{
    actId: number;
    actNumber: number;
    status: string | null;
    created: boolean;
    attachmentsManual: boolean;
    attachmentsPreserved: boolean;
  }>;
}

export interface WorkflowActGenerationResult extends ActGenerationResult {
  workflowId: number;
  workflowVersion: number;
  stage: WorkflowStage;
  mode: ActGenerationMode;
}

export interface ActsReadinessHook {
  (client: DbClient, workflow: ExecutionWorkflow): Promise<{ blockingIssues: readonly unknown[] }>;
}

async function generateInTransaction(
  client: DbClient,
  input: {
    schedule: Schedule;
    workflowId: number | null;
    mode: ActGenerationMode;
  },
): Promise<ActGenerationResult> {
  const objectId = Number(input.schedule.objectId);
  if (!Number.isInteger(objectId) || objectId <= 0) {
    throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Schedule object not found");
  }
  const tasks = await repo.listScheduleTasks(client, input.schedule.id);
  const { groups, skippedNoActNumber, invalidTaskId } = groupActTasks(tasks);
  if (invalidTaskId !== null) {
    throw new McpToolError(MCP_ERROR_CODES.VALIDATION_ERROR, `Invalid actNumber for task ${invalidTaskId}`);
  }
  const actNumbers = Array.from(groups.keys()).sort((left, right) => left - right);
  const positionIds = Array.from(new Set(tasks.flatMap((task) => task.estimatePositionId === null ? [] : [task.estimatePositionId])));
  const workIds = Array.from(new Set(tasks.flatMap((task) => task.workId === null ? [] : [task.workId])));
  const [positions, works, materialRows] = await Promise.all([
    repo.listEstimatePositions(client, positionIds),
    repo.listWorks(client, workIds),
    repo.listTaskMaterials(client, tasks.map((task) => task.id)),
  ]);
  const projectMaterialIds = Array.from(new Set(materialRows.map((row) => Number(row.projectMaterialId))));
  if (!(await repo.projectMaterialsBelongToObject(client, projectMaterialIds, objectId))) {
    throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Schedule references a material outside its object");
  }
  if (!(await repo.explicitQualityDocumentsAreValid(client, materialRows, objectId))) {
    throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Schedule references an unavailable quality document");
  }
  const fallbackDocuments = await repo.qualityDocumentFallbacks(client, projectMaterialIds);
  const positionById = new Map(positions.map((position) => [position.id, position]));
  const workById = new Map(works.map((work) => [work.id, work]));
  const materialsByTask = new Map<number, typeof materialRows>();
  for (const row of materialRows) {
    const list = materialsByTask.get(row.taskId) ?? [];
    list.push(row);
    materialsByTask.set(row.taskId, list);
  }

  let created = 0;
  let updated = 0;
  const warnings: ActGenerationWarning[] = [];
  const generatedActs: ActGenerationResult["acts"] = [];

  for (const actNumber of actNumbers) {
    const actTasks = groups.get(actNumber)!;
    const templateIds = Array.from(new Set(actTasks.flatMap((task) => task.actTemplateId === null ? [] : [task.actTemplateId])));
    const actTemplateId = templateIds[0] ?? null;
    if (templateIds.length === 0) {
      warnings.push({ actNumber, type: "no_template_type", message: `Акт №${actNumber}: не выбран тип акта (шаблон) ни у одной задачи` });
    } else if (templateIds.length > 1) {
      warnings.push({
        actNumber,
        type: "mixed_template_types",
        message: `Акт №${actNumber}: в задачах выбрано несколько типов актов (${templateIds.join(", ")}). Используется первый.`,
      });
    }

    let dateStart: string | null = null;
    let dateEnd: string | null = null;
    for (const task of actTasks) {
      const start = String(task.startDate);
      const end = addDaysISO(start, Math.max(0, Number(task.durationDays ?? 0) - 1));
      if (!dateStart || start < dateStart) dateStart = start;
      if (!dateEnd || end > dateEnd) dateEnd = end;
    }
    const projectDrawingsAgg = mergeActFreeText(actTasks.map((task) => task.projectDrawings));
    const normativeRefsAgg = mergeActFreeText(actTasks.map((task) => task.normativeRefs));
    const executiveSchemesAgg = aggregateActSchemes(actTasks);

    const sourceGroups = new Map<number, ScheduleTask[]>();
    for (const task of actTasks) {
      const sourceId = input.schedule.sourceType === "estimate" ? task.estimatePositionId : task.workId;
      if (sourceId === null) continue;
      const list = sourceGroups.get(sourceId) ?? [];
      list.push(task);
      sourceGroups.set(sourceId, list);
    }
    const worksData = Array.from(sourceGroups.entries()).flatMap(([sourceId, sourceTasks]) => {
      const source = input.schedule.sourceType === "estimate" ? positionById.get(sourceId) : workById.get(sourceId);
      if (!source) return [];
      const fallbackQuantity = input.schedule.sourceType === "estimate" ? (source as any).quantity : (source as any).quantityTotal;
      const quantity = sourceTasks.reduce((sum, task) => sum + Number(task.quantity ?? fallbackQuantity ?? 0), 0);
      return [{
        sourceType: input.schedule.sourceType as "estimate" | "works",
        sourceId,
        description: String(input.schedule.sourceType === "estimate" ? (source as any).name : (source as any).description),
        quantity: Number.isFinite(quantity) ? quantity : 0,
        unit: (sourceTasks[0]?.unit ?? (source as any).unit) || undefined,
        code: (source as any).code || undefined,
      }];
    }).sort((left, right) => String(left.code ?? "").localeCompare(String(right.code ?? "")));

    const persisted = await repo.upsertScopedAct(client, {
      objectId,
      workflowId: input.workflowId,
      scheduleId: input.schedule.id,
      actNumber,
      actTemplateId,
      dateStart,
      dateEnd,
      status: input.mode === "final" ? "generated" : "draft",
      worksData,
      projectDrawingsAgg: projectDrawingsAgg || null,
      normativeRefsAgg: normativeRefsAgg || null,
      executiveSchemesAgg: executiveSchemesAgg.length ? executiveSchemesAgg : null,
    });
    if (persisted.created) created++;
    else if (!persisted.preservedSigned) updated++;
    generatedActs.push({
      actId: persisted.act.id,
      actNumber,
      status: persisted.act.status,
      created: persisted.created,
      attachmentsManual: persisted.act.attachmentsManual,
      attachmentsPreserved: persisted.act.attachmentsManual,
    });
    if (persisted.preservedSigned) {
      warnings.push({
        actNumber,
        type: "signed_act_preserved",
        message: `Акт №${actNumber}: подписанный акт и его материалы оставлены без изменений`,
      });
      continue;
    }

    const taskWorkId = new Map(actTasks.map((task) => [task.id, task.workId]));
    const actMaterials = actTasks.flatMap((task) => materialsByTask.get(task.id) ?? []);
    const attachmentIds: number[] = [];
    const attachmentSeen = new Set<number>();
    let missingQualityDocs = 0;
    const usages = actMaterials.map((row) => {
      const qualityDocumentId = row.qualityDocumentId === null
        ? fallbackDocuments.get(Number(row.projectMaterialId)) ?? null
        : Number(row.qualityDocumentId);
      if (qualityDocumentId === null) missingQualityDocs++;
      else if (!attachmentSeen.has(qualityDocumentId)) {
        attachmentSeen.add(qualityDocumentId);
        attachmentIds.push(qualityDocumentId);
      }
      return {
        projectMaterialId: Number(row.projectMaterialId),
        workId: taskWorkId.get(row.taskId) ?? null,
        batchId: row.batchId === null ? null : Number(row.batchId),
        qualityDocumentId,
        note: row.note ?? null,
        orderIndex: Number(row.orderIndex ?? 0),
      };
    });
    await repo.replaceActMaterialUsages(client, persisted.act.id, usages);
    await repo.replaceAutomaticActAttachments(client, persisted.act, attachmentIds);

    if (usages.length === 0) warnings.push({ actNumber, type: "no_materials", message: `Акт №${actNumber}: нет материалов ни в одной задаче` });
    else if (missingQualityDocs > 0) warnings.push({
      actNumber,
      type: "no_quality_docs",
      message: `Акт №${actNumber}: у ${missingQualityDocs} материалов не указан документ качества`,
    });
    if (!projectDrawingsAgg) warnings.push({ actNumber, type: "no_drawings", message: `Акт №${actNumber}: не заполнены номера чертежей проекта` });
    if (!normativeRefsAgg) warnings.push({ actNumber, type: "no_normatives", message: `Акт №${actNumber}: не заполнены СНиП/ГОСТ/РД` });
  }

  const activeNumbers = new Set(actNumbers);
  for (const stale of await repo.listScopedActs(client, { objectId, workflowId: input.workflowId })) {
    if (stale.actNumber === null || activeNumbers.has(stale.actNumber)) continue;
    warnings.push({
      actNumber: stale.actNumber,
      type: "stale_act_preserved",
      message: `Акт №${stale.actNumber}: сохранён, хотя его номер больше не используется задачами текущего графика`,
    });
  }

  return {
    scheduleId: input.schedule.id,
    actNumbers,
    created,
    updated,
    skippedNoActNumber,
    deletedActNumbers: [],
    warnings,
    acts: generatedActs,
  };
}

/** Backward-compatible REST adapter: owner-scoped, transactional, and deliberately non-destructive. */
export async function generateActsForOwnedSchedule(userId: number, scheduleId: number): Promise<ActGenerationResult> {
  return db.transaction(async (tx) => {
    const schedule = await repo.getSchedule(tx, scheduleId);
    const objectId = Number(schedule?.objectId);
    if (!schedule || !Number.isInteger(objectId) || objectId <= 0 || !(await repo.getOwnedObject(tx, userId, objectId))) {
      throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Schedule not found");
    }
    const workflowId = await repo.findOwnedWorkflowIdBySchedule(tx, { userId, objectId, scheduleId });
    return generateInTransaction(tx, { schedule, workflowId, mode: "draft" });
  });
}

/** Workflow-owned MCP generation. Final generation additionally requires readiness and explicit confirmation. */
export async function generateActs(
  auth: McpAuthContext,
  args: {
    workflowId: number;
    mode: ActGenerationMode;
    confirmed: boolean;
    expectedVersion: number;
    idempotencyKey: string;
  },
  options: { readiness?: ActsReadinessHook } = {},
): Promise<WorkflowActGenerationResult> {
  return withIdempotency(auth.userId, "generate_acts", args.idempotencyKey, {
    workflowId: args.workflowId,
    mode: args.mode,
    confirmed: args.confirmed,
    expectedVersion: args.expectedVersion,
  }, async (tx) => {
    const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
    if (workflow.version !== args.expectedVersion) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });
    }
    if (!workflow.scheduleId || !["awaiting_quality_documents", "acts_blocked", "acts_ready", "acts_generated"].includes(workflow.stage)) {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_TRANSITION_NOT_ALLOWED, "Workflow cannot generate acts at this stage", { recoverable: true });
    }
    if (args.mode === "draft" && workflow.stage === "acts_generated") {
      throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_TRANSITION_NOT_ALLOWED, "A generated final act set cannot be downgraded to draft", { recoverable: true });
    }
    const schedule = await repo.getSchedule(tx, workflow.scheduleId);
    if (!schedule || schedule.objectId !== workflow.objectId) {
      throw new McpToolError(MCP_ERROR_CODES.NOT_FOUND, "Workflow schedule not found");
    }
    if (args.mode === "final") {
      if (!args.confirmed) {
        throw new McpToolError(MCP_ERROR_CODES.ACT_GENERATION_REQUIRES_CONFIRMATION, "Final act generation requires explicit confirmation", { recoverable: true });
      }
      const readiness = options.readiness ? await options.readiness(tx, workflow) : null;
      if (!readiness || readiness.blockingIssues.length > 0) {
        throw new McpToolError(MCP_ERROR_CODES.ACTS_NOT_READY, "Acts have blocking readiness issues", { recoverable: true });
      }
    }

    let updatedWorkflow = workflow;
    const transition = async (nextStage: WorkflowStage) => {
      const previous = updatedWorkflow;
      const updated = await workflowRepo.updateWorkflowStageIfVersionMatches(
        tx,
        workflow.id,
        previous.version,
        nextStage,
      );
      if (!updated) {
        throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });
      }
      updatedWorkflow = updated;
      await workflowRepo.insertWorkflowEvent(tx, {
        workflowId: workflow.id,
        eventType: "stage_transition",
        actorType: "system",
        actorId: null,
        payloadJson: { from: previous.stage, to: nextStage },
      });
    };
    if (args.mode === "draft") {
      if (updatedWorkflow.stage === "awaiting_quality_documents") await transition("acts_blocked");
      else {
        const touched = await workflowRepo.touchWorkflowIfVersionMatches(tx, workflow.id, updatedWorkflow.version);
        if (!touched) {
          throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });
        }
        updatedWorkflow = touched;
      }
    } else {
      if (updatedWorkflow.stage === "awaiting_quality_documents") await transition("acts_blocked");
      if (updatedWorkflow.stage === "acts_blocked") await transition("acts_ready");
      if (updatedWorkflow.stage === "acts_ready") await transition("acts_generated");
      else if (updatedWorkflow.stage === "acts_generated") {
        const touched = await workflowRepo.touchWorkflowIfVersionMatches(tx, workflow.id, updatedWorkflow.version);
        if (!touched) {
          throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });
        }
        updatedWorkflow = touched;
      }
    }
    const result = await generateInTransaction(tx, { schedule, workflowId: workflow.id, mode: args.mode });
    await workflowRepo.insertWorkflowEvent(tx, {
      workflowId: workflow.id,
      eventType: args.mode === "draft" ? "acts_draft_generated" : "acts_generated",
      actorType: "agent",
      actorId: String(auth.userId),
      payloadJson: { mode: args.mode, actNumbers: result.actNumbers },
    });
    return {
      ...result,
      workflowId: workflow.id,
      workflowVersion: updatedWorkflow.version,
      stage: updatedWorkflow.stage,
      mode: args.mode,
    };
  });
}
