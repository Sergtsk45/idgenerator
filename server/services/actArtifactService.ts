import { createHash, randomUUID } from "node:crypto";

import type { Act, ActArtifactKind, ActArtifactMode } from "@shared/schema";
import { db } from "../db";
import {
  newActArtifactStorageKey,
  readActArtifactFile,
  removeActArtifactFile,
  saveActArtifactFile,
} from "../act-artifact-files";
import { buildActAttachmentsPdf } from "../actAttachmentsPdf";
import {
  buildActDataFromSourceData,
  buildAttachmentsText,
  buildP3MaterialsText,
  generateAosrPdf,
  type ActData,
} from "../pdfGenerator";
import { storage } from "../storage";
import type { McpAuthContext } from "../mcp/authContext";
import { MCP_ERROR_CODES, McpToolError } from "../mcp/errors";
import { loadOwnedWorkflow, withIdempotency } from "./execution-workflow/workflowService";
import * as artifactRepo from "./acts/actArtifactRepository";
import { checkActsReadinessWithClient } from "./actsReadinessService";

interface ExportArgs {
  workflowId: number;
  actId: number;
  mode: ActArtifactMode;
  idempotencyKey: string;
  formData?: Partial<ActData>;
  templateIds?: string[];
}

function artifactNotOwned(): McpToolError {
  return new McpToolError(MCP_ERROR_CODES.ARTIFACT_NOT_OWNED, "Act artifact is not owned by this user");
}

function artifactFilename(act: Act, kind: ActArtifactKind): string {
  const number = act.actNumber ?? act.id;
  return kind === "act_pdf" ? `АОСР_${number}.pdf` : `Акт_${number}_приложения.pdf`;
}

async function buildPersistedActPdf(act: Act, args: ExportArgs): Promise<Buffer> {
  if (!act.objectId) throw artifactNotOwned();
  const sourceData = await storage.getObjectSourceData(act.objectId);
  const source = buildActDataFromSourceData(sourceData);
  const p1Works = Array.isArray(act.worksData)
    ? act.worksData.map((work, index) => {
        const quantity = Number(work.quantity);
        return `${index + 1}. ${work.description}${Number.isFinite(quantity) && quantity ? ` — ${quantity}` : ""}`;
      }).join("\n")
    : "";
  const schemes = Array.isArray(act.executiveSchemesAgg)
    ? act.executiveSchemesAgg.map((scheme) => scheme.fileUrl
      ? `Исполнительная схема: ${scheme.title} — ${scheme.fileUrl}`
      : `Исполнительная схема: ${scheme.title}`).join("\n")
    : "";
  const attachments = [await buildAttachmentsText(act.id), schemes].filter(Boolean).join("\n");
  const template = args.templateIds?.[0]
    ? await storage.getActTemplateByTemplateId(args.templateIds[0])
    : act.actTemplateId ? await storage.getActTemplate(act.actTemplateId) : undefined;
  const actData: ActData = {
    ...source,
    actNumber: String(act.actNumber ?? act.id),
    actDate: String(act.dateEnd ?? ""),
    workDescription: template?.description || template?.title || "Работы по акту (из графика)",
    dateStart: act.dateStart ?? "",
    dateEnd: act.dateEnd ?? "",
    p1Works,
    p2ProjectDocs: act.projectDrawingsAgg ?? "",
    p3MaterialsText: await buildP3MaterialsText(act.id),
    p6NormativeRefs: act.normativeRefsAgg ?? "",
    attachmentsText: attachments,
    ...args.formData,
  };
  return generateAosrPdf(actData);
}

async function persistArtifact(
  auth: McpAuthContext,
  args: ExportArgs,
  kind: ActArtifactKind,
  build: (act: Act, args: ExportArgs) => Promise<Buffer>,
) {
  const writtenKeys: string[] = [];
  try {
    return await withIdempotency(auth.userId, kind === "act_pdf" ? "export_act_pdf" : "export_act_attachments", args.idempotencyKey, args, async (tx) => {
      const workflow = await loadOwnedWorkflow(tx, auth, args.workflowId);
      const act = await artifactRepo.loadOwnedAct(tx, auth.userId, args.actId, workflow.id);
      if (!act || act.objectId !== workflow.objectId) throw artifactNotOwned();
      if (args.mode === "final" && act.status !== "generated" && act.status !== "signed") {
        throw new McpToolError(MCP_ERROR_CODES.ACTS_NOT_READY, "Final artifact requires a generated act");
      }
      if (args.mode === "final" && act.status === "generated") {
        const readiness = await checkActsReadinessWithClient(tx, workflow);
        if (readiness.blockingIssues.length > 0) {
          throw new McpToolError(MCP_ERROR_CODES.ACTS_NOT_READY, "Final artifact has blocking readiness issues", { recoverable: true });
        }
      }
      const buffer = await build(act, args);
      if (!buffer.length) throw new McpToolError(MCP_ERROR_CODES.ACTS_NOT_READY, "Artifact has no PDF content");
      const storageKey = newActArtifactStorageKey();
      await saveActArtifactFile(storageKey, buffer);
      writtenKeys.push(storageKey);
      const artifact = await artifactRepo.insertArtifact(tx, {
        id: randomUUID(),
        workflowId: workflow.id,
        actId: act.id,
        userId: auth.userId,
        objectId: workflow.objectId,
        kind,
        mode: args.mode,
        storageKey,
        filename: artifactFilename(act, kind),
        sizeBytes: buffer.length,
        sha256: createHash("sha256").update(buffer).digest("hex"),
      });
      return {
        artifactId: artifact.id,
        workflowId: workflow.id,
        actId: act.id,
        kind: artifact.kind,
        mode: artifact.mode,
        filename: artifact.filename,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        sha256: artifact.sha256,
        url: `/api/act-artifacts/${artifact.id}/file`,
        createdAt: artifact.createdAt.toISOString(),
      };
    });
  } catch (error) {
    // ponytail: compensate ordinary transaction failures; a process crash can leave
    // an unreferenced file, which a future bounded cleanup job can remove by storage key.
    await Promise.all(writtenKeys.map((key) => removeActArtifactFile(key).catch(() => undefined)));
    throw error;
  }
}

export function exportActPdf(auth: McpAuthContext, args: ExportArgs) {
  return persistArtifact(auth, args, "act_pdf", buildPersistedActPdf);
}

export function exportActAttachments(auth: McpAuthContext, args: ExportArgs) {
  return persistArtifact(auth, args, "attachments_pdf", async (act) => {
    const result = await buildActAttachmentsPdf(act.id);
    if (result.documentsCount === 0) {
      throw new McpToolError(MCP_ERROR_CODES.ACTS_NOT_READY, "Act has no attachments to export");
    }
    if (result.problems.length > 0) {
      throw new McpToolError(MCP_ERROR_CODES.ACTS_NOT_READY, "Act attachments are incomplete or invalid");
    }
    return result.buffer;
  });
}

export async function getOwnedArtifactFile(auth: McpAuthContext, artifactId: string) {
  const artifact = await artifactRepo.loadOwnedArtifact(db, auth.userId, artifactId);
  if (!artifact) throw artifactNotOwned();
  return { artifact, buffer: await readActArtifactFile(artifact.storageKey) };
}
