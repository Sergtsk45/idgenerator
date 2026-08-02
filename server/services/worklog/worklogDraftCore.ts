import { createHash } from "node:crypto";

import type { WorklogDraftEntry } from "@shared/schema";

export interface WorklogSourceInput {
  scheduleTasks: Array<{
    id: number;
    date: string;
    description: string;
    quantity: number | null;
    unit: string | null;
    sourceType: "estimate" | "works";
    sourceId: number | null;
  }>;
  messages: Array<{ id: number; date: string; description: string; quantity: number | null; unit: string | null }>;
  acts: Array<{
    id: number;
    date: string;
    status: string | null;
    works: Array<{ sourceType: "estimate" | "works"; sourceId: number; description: string; quantity: number; unit?: string }>;
  }>; 
  ignoredMessages: number;
  ignoredDraftActs?: number;
}

export function buildWorklogDraft(input: WorklogSourceInput) {
  const entries: WorklogDraftEntry[] = [];
  for (const task of input.scheduleTasks) {
    entries.push({
      date: task.date,
      description: task.description,
      quantity: task.quantity,
      unit: task.unit,
      sourceType: "schedule_task",
      sourceId: task.id,
      sourceItemIndex: 0,
      evidenceStatus: "planned",
    });
  }
  for (const message of input.messages) entries.push({
    ...message,
    sourceType: "message",
    sourceId: message.id,
    sourceItemIndex: 0,
    evidenceStatus: "reported",
  });
  for (const act of input.acts) {
    if (act.status !== "generated" && act.status !== "signed") continue;
    for (let sourceItemIndex = 0; sourceItemIndex < act.works.length; sourceItemIndex++) {
      const work = act.works[sourceItemIndex];
      entries.push({
      date: act.date,
      description: work.description,
      quantity: Number.isFinite(work.quantity) ? work.quantity : null,
      unit: work.unit ?? null,
      sourceType: "act",
      sourceId: act.id,
      sourceItemIndex,
      evidenceStatus: "act_confirmed",
      });
    }
  }
  entries.sort((left, right) => left.date.localeCompare(right.date)
    || ["planned", "reported", "act_confirmed"].indexOf(left.evidenceStatus)
      - ["planned", "reported", "act_confirmed"].indexOf(right.evidenceStatus)
    || left.sourceType.localeCompare(right.sourceType)
    || left.sourceId - right.sourceId
    || left.sourceItemIndex - right.sourceItemIndex
    || left.description.localeCompare(right.description));
  const warnings = [
    ...(input.ignoredMessages > 0 ? [`${input.ignoredMessages} messages without normalized work data were not treated as factual entries`] : []),
    ...((input.ignoredDraftActs ?? 0) > 0 ? [`${input.ignoredDraftActs} draft acts were not treated as confirmed evidence`] : []),
  ];
  const inputHash = createHash("sha256").update(JSON.stringify({ entries, warnings })).digest("hex");
  return { schemaVersion: 1, inputHash, entries, warnings };
}
