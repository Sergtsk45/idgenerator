import { and, eq } from "drizzle-orm";

import {
  actArtifacts,
  acts,
  executionWorkflows,
  objects,
  type Act,
  type ActArtifact,
  type ActArtifactKind,
  type ActArtifactMode,
} from "@shared/schema";
import type { DbClient } from "../execution-workflow/workflowRepository";

export async function loadOwnedAct(
  client: DbClient,
  userId: number,
  actId: number,
  workflowId?: number,
): Promise<Act | undefined> {
  const [row] = await client
    .select({ act: acts })
    .from(acts)
    .innerJoin(objects, and(eq(objects.id, acts.objectId), eq(objects.userId, userId)))
    .where(and(
      eq(acts.id, actId),
      workflowId === undefined ? undefined : eq(acts.workflowId, workflowId),
    ));
  return row?.act;
}

export async function insertArtifact(
  client: DbClient,
  data: {
    id: string;
    workflowId: number;
    actId: number;
    userId: number;
    objectId: number;
    kind: ActArtifactKind;
    mode: ActArtifactMode;
    storageKey: string;
    filename: string;
    sizeBytes: number;
    sha256: string;
  },
): Promise<ActArtifact> {
  const [created] = await client.insert(actArtifacts).values(data).returning();
  return created;
}

export async function loadOwnedArtifact(
  client: DbClient,
  userId: number,
  artifactId: string,
): Promise<ActArtifact | undefined> {
  const [row] = await client
    .select({ artifact: actArtifacts })
    .from(actArtifacts)
    .innerJoin(objects, and(eq(objects.id, actArtifacts.objectId), eq(objects.userId, userId)))
    .innerJoin(acts, and(
      eq(acts.id, actArtifacts.actId),
      eq(acts.objectId, actArtifacts.objectId),
      eq(acts.workflowId, actArtifacts.workflowId),
    ))
    .innerJoin(executionWorkflows, and(
      eq(executionWorkflows.id, actArtifacts.workflowId),
      eq(executionWorkflows.userId, actArtifacts.userId),
      eq(executionWorkflows.objectId, actArtifacts.objectId),
    ))
    .where(and(eq(actArtifacts.id, artifactId), eq(actArtifacts.userId, userId)));
  return row?.artifact;
}
