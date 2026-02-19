/**
 * @file: use-schedules.ts
 * @description: React Query хуки для schedule-модуля (дефолтный график, bootstrap задач из ВОР, обновление задач).
 * @dependencies: shared/routes.ts (api/buildUrl), TanStack Query
 * @created: 2026-01-17
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useDefaultSchedule() {
  return useQuery({
    queryKey: [api.schedules.default.path],
    queryFn: async () => {
      const res = await fetch(api.schedules.default.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch default schedule");
      return api.schedules.default.responses[200].parse(await res.json());
    },
  });
}

export function useSchedule(id: number | null | undefined) {
  return useQuery({
    queryKey: [api.schedules.get.path, id],
    queryFn: async () => {
      if (!id) throw new Error("Schedule id is required");
      const url = buildUrl(api.schedules.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch schedule");
      }
      return api.schedules.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useBootstrapScheduleFromWorks(scheduleId: number | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data?: {
      workIds?: number[];
      defaultStartDate?: string; // YYYY-MM-DD
      defaultDurationDays?: number;
    }) => {
      if (!scheduleId) throw new Error("Schedule id is required");
      const url = buildUrl(api.schedules.bootstrapFromWorks.path, { id: scheduleId });
      const res = await fetch(url, {
        method: api.schedules.bootstrapFromWorks.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ?? {}),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to bootstrap schedule");
      }

      return api.schedules.bootstrapFromWorks.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      if (!scheduleId) return;
      queryClient.invalidateQueries({ queryKey: [api.schedules.get.path, scheduleId] });
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
        startDate?: string; // YYYY-MM-DD
        durationDays?: number;
        orderIndex?: number;
        actNumber?: number | null;
        actTemplateId?: number | null;
        projectDrawings?: string | null;
        normativeRefs?: string | null;
        executiveSchemes?: Array<{ title: string; fileUrl?: string }> | null;
        quantity?: number | null;
        unit?: string | null;
        updateAllTasks?: boolean;
      };
      scheduleId?: number;
    }) => {
      const url = buildUrl(api.scheduleTasks.patch.path, { id: data.id });
      const res = await fetch(url, {
        method: api.scheduleTasks.patch.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.patch),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const err: any = new Error(errorData.message || "Failed to update schedule task");
        err.status = res.status;
        err.data = errorData;
        throw err;
      }

      return api.scheduleTasks.patch.responses[200].parse(await res.json());
    },
    onSuccess: (_updated, vars) => {
      if (vars.scheduleId) {
        queryClient.invalidateQueries({ queryKey: [api.schedules.get.path, vars.scheduleId] });
      } else {
        queryClient.invalidateQueries({ queryKey: [api.schedules.get.path] });
      }
    },
  });
}

export function useGenerateActsFromSchedule(scheduleId: number | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!scheduleId) throw new Error("Schedule id is required");
      const url = buildUrl(api.schedules.generateActs.path, { id: scheduleId });
      const res = await fetch(url, {
        method: api.schedules.generateActs.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate acts");
      }

      return api.schedules.generateActs.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      // Invalidate acts list and schedule
      queryClient.invalidateQueries({ queryKey: ["/api/acts"] });
      if (scheduleId) {
        queryClient.invalidateQueries({ queryKey: [api.schedules.get.path, scheduleId] });
      }
    },
  });
}

export function useScheduleSourceInfo(scheduleId: number | null | undefined) {
  return useQuery({
    queryKey: [api.schedules.sourceInfo.path, scheduleId],
    queryFn: async () => {
      if (!scheduleId) throw new Error("Schedule id is required");
      const url = buildUrl(api.schedules.sourceInfo.path, { id: scheduleId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch source info");
      }
      return api.schedules.sourceInfo.responses[200].parse(await res.json());
    },
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
      const res = await fetch(url, {
        method: api.schedules.changeSource.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to change schedule source");
      }

      return api.schedules.changeSource.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      if (!scheduleId) return;
      queryClient.invalidateQueries({ queryKey: [api.schedules.get.path, scheduleId] });
      queryClient.invalidateQueries({ queryKey: [api.schedules.sourceInfo.path, scheduleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/acts"] });
    },
  });
}

export function useBootstrapScheduleFromEstimate(scheduleId: number | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data?: {
      positionIds?: number[];
      defaultStartDate?: string; // YYYY-MM-DD
      defaultDurationDays?: number;
    }) => {
      if (!scheduleId) throw new Error("Schedule id is required");
      const url = buildUrl(api.schedules.bootstrapFromEstimate.path, { id: scheduleId });
      const res = await fetch(url, {
        method: api.schedules.bootstrapFromEstimate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ?? {}),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to bootstrap from estimate");
      }

      return api.schedules.bootstrapFromEstimate.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      if (!scheduleId) return;
      queryClient.invalidateQueries({ queryKey: [api.schedules.get.path, scheduleId] });
    },
  });
}

