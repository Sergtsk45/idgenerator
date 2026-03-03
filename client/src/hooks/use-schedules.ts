/**
 * @file: use-schedules.ts
 * @description: React Query хуки для schedule-модуля (дефолтный график, bootstrap задач из ВОР, обновление задач).
 * @dependencies: shared/routes.ts (api/buildUrl), TanStack Query
 * @created: 2026-01-17
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import type { schedules, scheduleTasks } from "@shared/schema";

type Schedule = typeof schedules.$inferSelect & { tasks: typeof scheduleTasks.$inferSelect[] };
type ScheduleBase = typeof schedules.$inferSelect;
type SourceInfo = {
  sourceType: 'works' | 'estimate';
  estimateId: number | null;
  estimateName: string | null;
  tasksCount: number;
  affectedActNumbers: number[];
};

export function useDefaultSchedule() {
  return useQuery<ScheduleBase>({
    queryKey: [api.schedules.default.path],
    queryFn: getQueryFn({ on401: "throw" }),
  });
}

export function useSchedule(id: number | null | undefined) {
  return useQuery<Schedule>({
    queryKey: [buildUrl(api.schedules.get.path, { id: id ?? 0 })],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });
}

export function useBootstrapScheduleFromWorks(scheduleId: number | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data?: {
      workIds?: number[];
      defaultStartDate?: string;
      defaultDurationDays?: number;
    }) => {
      if (!scheduleId) throw new Error("Schedule id is required");
      const url = buildUrl(api.schedules.bootstrapFromWorks.path, { id: scheduleId });
      const res = await apiRequest(api.schedules.bootstrapFromWorks.method, url, data ?? {});
      return api.schedules.bootstrapFromWorks.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      if (!scheduleId) return;
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.schedules.get.path, { id: scheduleId })] });
    },
  });
}

export function usePatchScheduleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: number;
      patch: {
        titleOverride?: string | null;
        startDate?: string;
        durationDays?: number;
        orderIndex?: number;
        actNumber?: number | null;
        actTemplateId?: number | null;
        projectDrawings?: string | null;
        normativeRefs?: string | null;
        executiveSchemes?: Array<{ title: string; fileUrl?: string }> | null;
        quantity?: number | null;
        unit?: string | null;
        independentMaterials?: boolean;
        updateAllTasks?: boolean;
      };
      scheduleId?: number;
    }) => {
      const url = buildUrl(api.scheduleTasks.patch.path, { id: data.id });
      const res = await apiRequest(api.scheduleTasks.patch.method, url, data.patch);
      return api.scheduleTasks.patch.responses[200].parse(await res.json());
    },
    onSuccess: (_updated, vars) => {
      if (vars.scheduleId) {
        queryClient.invalidateQueries({ queryKey: [buildUrl(api.schedules.get.path, { id: vars.scheduleId })] });
      }
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/api/schedules/') });
    },
  });
}

export function useGenerateActsFromSchedule(scheduleId: number | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!scheduleId) throw new Error("Schedule id is required");
      const url = buildUrl(api.schedules.generateActs.path, { id: scheduleId });
      const res = await apiRequest(api.schedules.generateActs.method, url, {});
      return api.schedules.generateActs.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acts"] });
      if (scheduleId) {
        queryClient.invalidateQueries({ queryKey: [buildUrl(api.schedules.get.path, { id: scheduleId })] });
      }
    },
  });
}

export function useScheduleSourceInfo(scheduleId: number | null | undefined) {
  return useQuery<SourceInfo>({
    queryKey: [buildUrl(api.schedules.sourceInfo.path, { id: scheduleId ?? 0 })],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!scheduleId,
  });
}

export function useChangeScheduleSource(scheduleId: number | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      newSourceType: 'works' | 'estimate';
      estimateId?: number;
      confirmReset: boolean;
    }) => {
      if (!scheduleId) throw new Error("Schedule id is required");
      const url = buildUrl(api.schedules.changeSource.path, { id: scheduleId });
      const res = await apiRequest(api.schedules.changeSource.method, url, data);
      return api.schedules.changeSource.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      if (!scheduleId) return;
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.schedules.get.path, { id: scheduleId })] });
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.schedules.sourceInfo.path, { id: scheduleId })] });
      queryClient.invalidateQueries({ queryKey: ["/api/acts"] });
    },
  });
}

export function useBootstrapScheduleFromEstimate(scheduleId: number | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data?: {
      positionIds?: number[];
      defaultStartDate?: string;
      defaultDurationDays?: number;
    }) => {
      if (!scheduleId) throw new Error("Schedule id is required");
      const url = buildUrl(api.schedules.bootstrapFromEstimate.path, { id: scheduleId });
      const res = await apiRequest(api.schedules.bootstrapFromEstimate.method, url, data ?? {});
      return api.schedules.bootstrapFromEstimate.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      if (!scheduleId) return;
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.schedules.get.path, { id: scheduleId })] });
    },
  });
}

export function useSplitScheduleTask(scheduleId: number | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      taskId: number;
      splitDate: string;
      quantityFirst?: string;
      quantitySecond?: string;
      newActNumber?: number;
      inherit?: {
        materials?: boolean;
        projectDrawings?: boolean;
        normativeRefs?: boolean;
        executiveSchemes?: boolean;
      };
    }) => {
      const url = buildUrl(api.scheduleTasks.split.path, { id: data.taskId });
      const res = await apiRequest(api.scheduleTasks.split.method, url, {
        splitDate: data.splitDate,
        quantityFirst: data.quantityFirst,
        quantitySecond: data.quantitySecond,
        newActNumber: data.newActNumber,
        inherit: data.inherit,
      });
      return api.scheduleTasks.split.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      if (scheduleId) {
        queryClient.invalidateQueries({ queryKey: [buildUrl(api.schedules.get.path, { id: scheduleId })] });
      }
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/api/schedules/') });
    },
  });
}

export function useSplitSiblings(taskId: number | null | undefined) {
  return useQuery({
    queryKey: [buildUrl(api.scheduleTasks.splitSiblings.path, { id: taskId ?? 0 })],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!taskId,
  });
}
