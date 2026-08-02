import type { ScheduleTask } from "@shared/schema";

export function mergeActFreeText(values: Array<string | null | undefined>): string {
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const token of String(value ?? "").split(/[\n,;]+/g).map((part) => part.trim()).filter(Boolean)) {
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push(token);
    }
  }
  return tokens.join(", ");
}

export function groupActTasks(tasks: ScheduleTask[]): {
  groups: Map<number, ScheduleTask[]>;
  skippedNoActNumber: number;
  invalidTaskId: number | null;
} {
  const groups = new Map<number, ScheduleTask[]>();
  let skippedNoActNumber = 0;
  for (const task of tasks) {
    if (task.actNumber === null) {
      skippedNoActNumber++;
      continue;
    }
    const actNumber = Number(task.actNumber);
    if (!Number.isFinite(actNumber) || actNumber <= 0) {
      return { groups, skippedNoActNumber, invalidTaskId: task.id };
    }
    const list = groups.get(actNumber) ?? [];
    list.push(task);
    groups.set(actNumber, list);
  }
  return { groups, skippedNoActNumber, invalidTaskId: null };
}

export function aggregateActSchemes(tasks: ScheduleTask[]): Array<{ title: string; fileUrl?: string }> {
  const seen = new Set<string>();
  const result: Array<{ title: string; fileUrl?: string }> = [];
  for (const task of tasks) {
    if (!Array.isArray(task.executiveSchemes)) continue;
    for (const scheme of task.executiveSchemes) {
      const title = String(scheme?.title ?? "").trim();
      const fileUrl = String(scheme?.fileUrl ?? "").trim();
      if (!title) continue;
      const key = `${title.toLowerCase()}|${fileUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(fileUrl ? { title, fileUrl } : { title });
    }
  }
  return result;
}
