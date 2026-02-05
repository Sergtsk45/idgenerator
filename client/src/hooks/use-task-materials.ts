/**
 * @file: use-task-materials.ts
 * @description: React Query хуки для материалов, привязанных к задаче графика (schedule_tasks → task_materials).
 * @dependencies: shared/routes.ts (api/buildUrl), TanStack Query
 * @created: 2026-02-05
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export type TaskMaterialDto = {
  id: number;
  taskId: number;
  projectMaterialId: number;
  batchId: number | null;
  qualityDocumentId: number | null;
  note: string | null;
  orderIndex: number;
  createdAt: unknown;
  projectMaterialName?: string | null;
  batchLabel?: string | null;
  qualityDocumentTitle?: string | null;
  qualityDocumentNumber?: string | null;
  qualityDocumentFileUrl?: string | null;
};

export function useTaskMaterials(taskId: number | null | undefined) {
  return useQuery({
    queryKey: [api.taskMaterials.list.path, taskId],
    queryFn: async () => {
      if (!taskId) throw new Error("Task id is required");
      const url = buildUrl(api.taskMaterials.list.path, { id: taskId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch task materials");
      }
      return api.taskMaterials.list.responses[200].parse(await res.json());
    },
    enabled: !!taskId,
  });
}

export function useReplaceTaskMaterials(taskId: number | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      items: Array<{
        projectMaterialId: number;
        batchId?: number | null;
        qualityDocumentId?: number | null;
        note?: string | null;
        orderIndex?: number;
      }>;
    }) => {
      if (!taskId) throw new Error("Task id is required");
      const url = buildUrl(api.taskMaterials.replace.path, { id: taskId });
      const res = await fetch(url, {
        method: api.taskMaterials.replace.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update task materials");
      }
      return api.taskMaterials.replace.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.taskMaterials.list.path, taskId] });
    },
  });
}

