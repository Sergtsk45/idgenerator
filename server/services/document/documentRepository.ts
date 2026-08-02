import { and, asc, eq, isNull, or } from "drizzle-orm";

import {
  documentBindings,
  documents,
  executionWorkflows,
  materialRegisterItems,
  objects,
  projectMaterials,
  uploadSessions,
  type Document,
  type DocumentBinding,
  type InsertDocument,
  type InsertDocumentBinding,
  type MaterialRegisterItem,
  type ProjectMaterial,
  type UploadSession,
} from "@shared/schema";
import type { DbClient } from "../execution-workflow/workflowRepository";

export async function createDocument(
  client: DbClient,
  objectId: number,
  userId: number,
  data: Omit<InsertDocument, "objectId">,
): Promise<Document> {
  const scope = data.scope === "global" ? "global" : "project";
  const [created] = await client
    .insert(documents)
    .values({
      ...data,
      scope,
      objectId: scope === "project" ? objectId : null,
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning();
  return created;
}

export async function updateDocument(
  client: DbClient,
  id: number,
  userId: number,
  objectId: number,
  patch: Partial<Pick<Document, "docType" | "title" | "docNumber" | "docDate" | "validFrom" | "validTo" | "fileUrl">>,
): Promise<Document | undefined> {
  const [updated] = await client
    .update(documents)
    .set({ ...patch, updatedByUserId: userId })
    .where(and(
      eq(documents.id, id),
      isNull(documents.deletedAt),
      or(eq(documents.scope, "global"), eq(documents.objectId, objectId)),
    ))
    .returning();
  return updated;
}

export async function loadOwnedProjectDocument(
  client: DbClient,
  userId: number,
  objectId: number,
  documentId: number,
): Promise<Document | undefined> {
  const [row] = await client
    .select({ document: documents })
    .from(documents)
    .innerJoin(objects, and(eq(objects.id, documents.objectId), eq(objects.userId, userId)))
    .where(and(
      eq(documents.id, documentId),
      eq(documents.scope, "project"),
      eq(documents.objectId, objectId),
      isNull(documents.deletedAt),
    ));
  return row?.document;
}

export async function createBinding(
  client: DbClient,
  data: InsertDocumentBinding,
  defaultObjectId?: number,
): Promise<DocumentBinding> {
  const [created] = await client
    .insert(documentBindings)
    .values({ ...data, objectId: data.objectId ?? defaultObjectId })
    .returning();
  return created;
}

export interface OwnedActiveRegisterItem {
  item: MaterialRegisterItem;
  material: ProjectMaterial;
  objectId: number;
}

export async function loadOwnedActiveRegisterItem(
  client: DbClient,
  userId: number,
  workflowId: number,
  projectMaterialId: number,
): Promise<OwnedActiveRegisterItem | undefined> {
  const [row] = await client
    .select({
      item: materialRegisterItems,
      material: projectMaterials,
      objectId: executionWorkflows.objectId,
    })
    .from(materialRegisterItems)
    .innerJoin(executionWorkflows, eq(executionWorkflows.id, materialRegisterItems.workflowId))
    .innerJoin(projectMaterials, eq(projectMaterials.id, materialRegisterItems.projectMaterialId))
    .where(and(
      eq(executionWorkflows.id, workflowId),
      eq(executionWorkflows.userId, userId),
      eq(materialRegisterItems.projectMaterialId, projectMaterialId),
      eq(materialRegisterItems.active, true),
      eq(projectMaterials.objectId, executionWorkflows.objectId),
      isNull(projectMaterials.deletedAt),
    ));
  return row;
}

export async function loadOwnedUploadSession(
  client: DbClient,
  userId: number,
  uploadId: string,
  workflowId?: number,
): Promise<UploadSession | undefined> {
  const [row] = await client
    .select({ session: uploadSessions })
    .from(uploadSessions)
    .innerJoin(executionWorkflows, and(
      eq(executionWorkflows.id, uploadSessions.workflowId),
      eq(executionWorkflows.userId, uploadSessions.userId),
      eq(executionWorkflows.objectId, uploadSessions.objectId),
    ))
    .where(and(
      eq(uploadSessions.id, uploadId),
      eq(uploadSessions.userId, userId),
      workflowId === undefined ? undefined : eq(uploadSessions.workflowId, workflowId),
    ));
  return row?.session;
}

export async function consumeQualityDocumentUpload(
  client: DbClient,
  args: {
    uploadId: string;
    userId: number;
    workflowId: number;
    documentId: number;
    projectMaterialId: number;
  },
): Promise<UploadSession | undefined> {
  const [row] = await client
    .update(uploadSessions)
    .set({
      status: "consumed",
      consumedAt: new Date(),
      documentId: args.documentId,
      projectMaterialId: args.projectMaterialId,
    })
    .where(and(
      eq(uploadSessions.id, args.uploadId),
      eq(uploadSessions.userId, args.userId),
      eq(uploadSessions.workflowId, args.workflowId),
      eq(uploadSessions.purpose, "quality_document"),
      eq(uploadSessions.status, "uploaded"),
      isNull(uploadSessions.documentId),
      isNull(uploadSessions.projectMaterialId),
    ))
    .returning();
  return row;
}

export interface MaterialDocumentRow {
  binding: DocumentBinding;
  document: Document;
}

export async function getMaterialDocument(
  client: DbClient,
  userId: number,
  workflowId: number,
  projectMaterialId: number,
  documentId: number,
): Promise<MaterialDocumentRow | undefined> {
  const [row] = await client
    .select({ binding: documentBindings, document: documents })
    .from(documentBindings)
    .innerJoin(documents, eq(documents.id, documentBindings.documentId))
    .innerJoin(materialRegisterItems, and(
      eq(materialRegisterItems.workflowId, workflowId),
      eq(materialRegisterItems.projectMaterialId, documentBindings.projectMaterialId),
      eq(materialRegisterItems.active, true),
    ))
    .innerJoin(executionWorkflows, and(
      eq(executionWorkflows.id, materialRegisterItems.workflowId),
      eq(executionWorkflows.userId, userId),
    ))
    .where(and(
      eq(documentBindings.documentId, documentId),
      eq(documentBindings.projectMaterialId, projectMaterialId),
      eq(documentBindings.objectId, executionWorkflows.objectId),
      isNull(documents.deletedAt),
      or(eq(documents.scope, "global"), eq(documents.objectId, executionWorkflows.objectId)),
    ));
  return row;
}

export async function getOwnedConsumedMaterialDocument(
  client: DbClient,
  userId: number,
  workflowId: number,
  projectMaterialId: number,
  documentId: number,
): Promise<MaterialDocumentRow | undefined> {
  const [row] = await client
    .select({ binding: documentBindings, document: documents })
    .from(documentBindings)
    .innerJoin(documents, eq(documents.id, documentBindings.documentId))
    .innerJoin(executionWorkflows, and(
      eq(executionWorkflows.id, workflowId),
      eq(executionWorkflows.userId, userId),
      eq(executionWorkflows.objectId, documentBindings.objectId),
    ))
    .where(and(
      eq(documentBindings.documentId, documentId),
      eq(documentBindings.projectMaterialId, projectMaterialId),
      eq(documents.scope, "project"),
      eq(documents.objectId, executionWorkflows.objectId),
      isNull(documents.deletedAt),
    ));
  return row;
}

export async function listMaterialDocuments(
  client: DbClient,
  userId: number,
  workflowId: number,
  projectMaterialId: number,
): Promise<MaterialDocumentRow[]> {
  return client
    .select({ binding: documentBindings, document: documents })
    .from(documentBindings)
    .innerJoin(documents, eq(documents.id, documentBindings.documentId))
    .innerJoin(materialRegisterItems, and(
      eq(materialRegisterItems.workflowId, workflowId),
      eq(materialRegisterItems.projectMaterialId, documentBindings.projectMaterialId),
      eq(materialRegisterItems.active, true),
    ))
    .innerJoin(executionWorkflows, and(
      eq(executionWorkflows.id, materialRegisterItems.workflowId),
      eq(executionWorkflows.userId, userId),
    ))
    .where(and(
      eq(documentBindings.projectMaterialId, projectMaterialId),
      eq(documentBindings.objectId, executionWorkflows.objectId),
      isNull(documents.deletedAt),
      or(eq(documents.scope, "global"), eq(documents.objectId, executionWorkflows.objectId)),
    ))
    .orderBy(asc(documentBindings.id));
}
