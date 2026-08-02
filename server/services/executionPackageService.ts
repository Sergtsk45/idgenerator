import { createHash, randomUUID } from "node:crypto";

import type { ExecutionPackageMode, ExecutionWorkflow } from "@shared/schema";
import { db } from "../db";
import { readActArtifactFile } from "../act-artifact-files";
import type { McpAuthContext } from "../mcp/authContext";
import { MCP_ERROR_CODES, McpToolError } from "../mcp/errors";
import { checkActsReadinessWithClient } from "./actsReadinessService";
import * as workflowRepo from "./execution-workflow/workflowRepository";
import type { DbClient } from "./execution-workflow/workflowRepository";
import { loadOwnedWorkflow, withIdempotency } from "./execution-workflow/workflowService";
import {
  buildExecutionPackageManifest,
  type ExpectedPackageArtifact,
  type PackageArtifactMetadata,
  type PackageManifestNote,
} from "./execution-package/executionPackageManifestCore";
import {
  newExecutionPackageStorageKey,
  readExecutionPackageFile,
  removeExecutionPackageFile,
  saveExecutionPackageFile,
} from "./execution-package/executionPackageFiles";
import * as packageRepo from "./execution-package/executionPackageRepository";
import { buildZipArchive, type ZipEntry } from "./execution-package/zipArchive";
import { buildWorklogDraft } from "./worklog/worklogDraftCore";
import * as worklogRepo from "./worklog/worklogRepository";

function sha256(contents: Buffer): string { return createHash("sha256").update(contents).digest("hex"); }
function jsonBuffer(value: unknown): Buffer { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"); }

async function hydratePackage(client: DbClient, auth: McpAuthContext, workflow: ExecutionWorkflow, mode: ExecutionPackageMode) {
  if (!workflow.scheduleId) throw new McpToolError(MCP_ERROR_CODES.HANDOVER_NOT_READY, "Workflow has no approved schedule");
  const sources = await packageRepo.loadPackageSources(client, {
    workflowId: workflow.id,
    userId: auth.userId,
    objectId: workflow.objectId,
    scheduleId: workflow.scheduleId,
  });
  const expected: ExpectedPackageArtifact[] = [
    { key: "schedule", kind: "schedule_json", requiredMode: mode, required: true, label: "Approved schedule" },
    { key: "worklog", kind: "worklog_json", requiredMode: mode, required: true, label: "Draft worklog" },
    { key: "events", kind: "workflow_events_json", requiredMode: mode, required: true, label: "Workflow action log" },
  ];
  const available: PackageArtifactMetadata[] = [];
  const entries: ZipEntry[] = [];
  const blockers: PackageManifestNote[] = [];
  const warnings: PackageManifestNote[] = [];
  warnings.push({ code: "WORKLOG_DRAFT_SCOPE", message: "Worklog is a traceable draft and does not claim complete normative OЖР coverage" });

  if (!sources.schedule) blockers.push({ code: "SCHEDULE_MISSING", message: "Approved schedule is unavailable" });
  else {
    const contents = jsonBuffer({ schedule: sources.schedule, tasks: sources.tasks });
    entries.push({ name: "schedule/schedule.json", contents });
    available.push({ expectedKey: "schedule", artifactId: `schedule-${sources.schedule.id}`, workflowId: workflow.id, objectId: workflow.objectId, kind: "schedule_json", mode, filename: "schedule/schedule.json", mimeType: "application/json", sizeBytes: contents.length, sha256: sha256(contents), createdAt: (sources.schedule.createdAt ?? workflow.createdAt).toISOString() });
  }

  const currentWorklog = buildWorklogDraft(await worklogRepo.loadWorklogSources(client, {
    workflowId: workflow.id,
    userId: auth.userId,
    objectId: workflow.objectId,
    scheduleId: workflow.scheduleId,
  }));
  if (!sources.worklogDraft) blockers.push({ code: "WORKLOG_DRAFT_NOT_FOUND", message: "Draft worklog has not been generated" });
  else if (sources.worklogDraft.inputHash !== currentWorklog.inputHash) {
    blockers.push({ code: "WORKLOG_DRAFT_STALE", message: "Draft worklog is stale and must be regenerated" });
  } else {
    const contents = jsonBuffer({ title: "Черновик журнала работ", normativeCompletenessClaimed: false, ...currentWorklog });
    entries.push({ name: "worklog/worklog-draft.json", contents });
    available.push({ expectedKey: "worklog", artifactId: `worklog-${sources.worklogDraft.id}`, workflowId: workflow.id, objectId: workflow.objectId, kind: "worklog_json", mode, filename: "worklog/worklog-draft.json", mimeType: "application/json", sizeBytes: contents.length, sha256: sha256(contents), createdAt: sources.worklogDraft.createdAt.toISOString() });
    warnings.push(...currentWorklog.warnings.map((message) => ({ code: "WORKLOG_SOURCE_WARNING", message })));
  }

  const safeEvents = sources.events
    .filter((event) => event.eventType !== "execution_package_built")
    .map((event) => ({ eventType: event.eventType, actorType: event.actorType, createdAt: event.createdAt.toISOString() }));
  const eventContents = jsonBuffer(safeEvents);
  entries.push({ name: "workflow/events.json", contents: eventContents });
  available.push({ expectedKey: "events", artifactId: `events-${workflow.id}`, workflowId: workflow.id, objectId: workflow.objectId, kind: "workflow_events_json", mode, filename: "workflow/events.json", mimeType: "application/json", sizeBytes: eventContents.length, sha256: sha256(eventContents), createdAt: workflow.createdAt.toISOString() });

  let actsReadiness: Awaited<ReturnType<typeof checkActsReadinessWithClient>> | null = null;
  try { actsReadiness = await checkActsReadinessWithClient(client, workflow); }
  catch (error) {
    if (!(error instanceof McpToolError)) throw error;
    blockers.push({ code: error.code, message: error.message });
  }
  blockers.push(...(actsReadiness?.blockingIssues ?? []).map((issue) => ({ code: issue.code, message: issue.reason })));
  if (sources.acts.length === 0) blockers.push({ code: "ACTS_MISSING", message: "Workflow has no generated acts" });

  for (const act of sources.acts) {
    const actKey = `act:${act.id}:pdf`;
    expected.push({ key: actKey, kind: "act_pdf", requiredMode: mode, required: true, label: `Act ${act.actNumber ?? act.id}` });
    if (act.status !== "generated" && act.status !== "signed") {
      blockers.push({ code: "ACT_NOT_FINAL", message: `Act ${act.actNumber ?? act.id} is not generated` });
    }
    const needsAttachments = sources.attachmentActIds.has(act.id);
    if (needsAttachments) expected.push({ key: `act:${act.id}:attachments`, kind: "attachments_pdf", requiredMode: mode, required: true, label: `Act ${act.actNumber ?? act.id} attachments` });
    for (const kind of ["act_pdf", ...(needsAttachments ? ["attachments_pdf"] : [])] as const) {
      const artifact = sources.artifacts.find((candidate) => candidate.actId === act.id
        && candidate.kind === kind && (mode === "draft" || candidate.mode === "final"));
      if (!artifact) continue;
      let contents: Buffer;
      try { contents = await readActArtifactFile(artifact.storageKey); }
      catch { blockers.push({ code: "ARTIFACT_FILE_MISSING", message: `${kind} for act ${act.id} is unavailable` }); continue; }
      if (contents.length !== artifact.sizeBytes || sha256(contents) !== artifact.sha256) {
        blockers.push({ code: "ARTIFACT_CHECKSUM_MISMATCH", message: `${kind} for act ${act.id} failed integrity verification` });
        continue;
      }
      const expectedKey = kind === "act_pdf" ? actKey : `act:${act.id}:attachments`;
      const filename = kind === "act_pdf" ? `acts/act-${act.id}.pdf` : `acts/act-${act.id}-attachments.pdf`;
      entries.push({ name: filename, contents });
      available.push({ expectedKey, artifactId: artifact.id, workflowId: workflow.id, objectId: workflow.objectId, kind, mode: artifact.mode, filename, mimeType: artifact.mimeType, sizeBytes: contents.length, sha256: artifact.sha256, createdAt: artifact.createdAt.toISOString() });
    }
  }

  const draftJson = sources.scheduleDraft?.draftJson as { assumptions?: Array<{ description?: string; value?: unknown }> } | undefined;
  const assumptions = (draftJson?.assumptions ?? []).map((assumption) => assumption.description
    ? `${assumption.description}${assumption.value === undefined ? "" : `: ${String(assumption.value)}`}`
    : JSON.stringify(assumption));
  const manifest = buildExecutionPackageManifest({
    workflowId: workflow.id,
    objectId: workflow.objectId,
    mode,
    expectedArtifacts: expected,
    availableArtifacts: available,
    blockers,
    warnings,
    assumptions,
  });
  return { manifest, entries };
}

export async function checkHandoverReadiness(auth: McpAuthContext, workflowId: number) {
  const workflow = await loadOwnedWorkflow(db, auth, workflowId);
  const { manifest } = await hydratePackage(db, auth, workflow, "final");
  return { workflowVersion: workflow.version, stage: workflow.stage, ...manifest };
}

function packageResult(row: NonNullable<Awaited<ReturnType<typeof packageRepo.findPackageByInput>>>, stage: string, version: number) {
  return { packageId: row.id, workflowId: row.workflowId, workflowVersion: version, stage, mode: row.mode, inputHash: row.inputHash, filename: row.filename, sizeBytes: row.sizeBytes, sha256: row.sha256, manifest: row.manifestJson, url: `/api/execution-packages/${row.id}/file`, createdAt: row.createdAt.toISOString() };
}

export async function buildExecutionPackage(auth: McpAuthContext, args: {
  workflowId: number;
  mode: ExecutionPackageMode;
  confirmFinal: boolean;
  expectedVersion: number;
  idempotencyKey: string;
}) {
  let writtenKey: string | undefined;
  try {
    return await withIdempotency(auth.userId, "build_execution_package", args.idempotencyKey, args, async (tx) => {
      const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
      if (workflow.version !== args.expectedVersion) throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });
      if (!["worklog_draft_ready", "package_ready"].includes(workflow.stage)) throw new McpToolError(MCP_ERROR_CODES.WORKLOG_NOT_READY, "Fresh worklog draft is required", { recoverable: true });
      if (args.mode === "final" && !args.confirmFinal) throw new McpToolError(MCP_ERROR_CODES.PACKAGE_REQUIRES_CONFIRMATION, "Final package requires explicit confirmation", { recoverable: true });
      const hydrated = await hydratePackage(tx, auth, workflow, args.mode);
      const existing = await packageRepo.findPackageByInput(tx, workflow.id, args.mode, hydrated.manifest.inputHash);
      if (existing) {
        let contents: Buffer;
        try { contents = await readExecutionPackageFile(existing.storageKey); }
        catch { throw new McpToolError(MCP_ERROR_CODES.PACKAGE_FILE_UNAVAILABLE, "Existing execution package file is unavailable"); }
        if (contents.length !== existing.sizeBytes || sha256(contents) !== existing.sha256) {
          throw new McpToolError(MCP_ERROR_CODES.PACKAGE_FILE_UNAVAILABLE, "Existing execution package failed integrity verification");
        }
        return packageResult(existing, workflow.stage, workflow.version);
      }
      if (args.mode === "final" && !hydrated.manifest.readyForFinal) throw new McpToolError(MCP_ERROR_CODES.HANDOVER_NOT_READY, "Final package has critical blockers", { recoverable: true });

      const updated = args.mode === "final" && workflow.stage === "worklog_draft_ready"
        ? await workflowRepo.updateWorkflowStageIfVersionMatches(tx, workflow.id, args.expectedVersion, "package_ready")
        : await workflowRepo.touchWorkflowIfVersionMatches(tx, workflow.id, args.expectedVersion);
      if (!updated) throw new McpToolError(MCP_ERROR_CODES.WORKFLOW_VERSION_CONFLICT, "Workflow was modified concurrently", { recoverable: true });
      let zip: Buffer;
      try { zip = buildZipArchive([...hydrated.entries, { name: "manifest.json", contents: jsonBuffer(hydrated.manifest) }]); }
      catch (error) { throw new McpToolError(MCP_ERROR_CODES.PACKAGE_TOO_LARGE, error instanceof Error ? error.message : "Package exceeds limits"); }
      writtenKey = newExecutionPackageStorageKey();
      await saveExecutionPackageFile(writtenKey, zip);
      const row = await packageRepo.insertPackage(tx, {
        id: randomUUID(), workflowId: workflow.id, userId: auth.userId, objectId: workflow.objectId,
        mode: args.mode, inputHash: hydrated.manifest.inputHash, manifestJson: hydrated.manifest,
        storageKey: writtenKey, filename: `execution-package-${workflow.id}-${args.mode}.zip`,
        sizeBytes: zip.length, sha256: sha256(zip),
      });
      await workflowRepo.insertWorkflowEvent(tx, { workflowId: workflow.id, eventType: "execution_package_built", actorType: "agent", actorId: String(auth.userId), payloadJson: { packageId: row.id, mode: row.mode, inputHash: row.inputHash } });
      return packageResult(row, updated.stage, updated.version);
    });
  } catch (error) {
    if (writtenKey) await removeExecutionPackageFile(writtenKey).catch(() => undefined);
    throw error;
  }
}

export async function getOwnedExecutionPackageFile(auth: McpAuthContext, packageId: string) {
  const row = await packageRepo.loadOwnedPackage(db, auth.userId, packageId);
  if (!row) throw new McpToolError(MCP_ERROR_CODES.PACKAGE_NOT_OWNED, "Execution package is not owned by this user");
  let buffer: Buffer;
  try { buffer = await readExecutionPackageFile(row.storageKey); }
  catch { throw new McpToolError(MCP_ERROR_CODES.PACKAGE_FILE_UNAVAILABLE, "Execution package file is unavailable"); }
  if (buffer.length !== row.sizeBytes || sha256(buffer) !== row.sha256) throw new McpToolError(MCP_ERROR_CODES.PACKAGE_FILE_UNAVAILABLE, "Execution package file failed integrity verification");
  return { package: row, buffer };
}
