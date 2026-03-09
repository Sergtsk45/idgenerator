/**
 * @file: use-work-collections.ts
 * @description: React Query хуки для коллекций ВОР: список, детали, импорт, удаление
 * @dependencies: @shared/routes, @tanstack/react-query
 * @created: 2026-02-24
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { createApiHeaders } from "@/lib/api-headers";

export type DeleteWorkCollectionInput = {
  id: number;
  resetSchedule?: boolean;
};

export function useWorkCollections() {
  return useQuery({
    queryKey: [api.workCollections.list.path],
    queryFn: async () => {
      const res = await fetch(api.workCollections.list.path, { headers: createApiHeaders(), credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch work collections");
      }
      return api.workCollections.list.responses[200].parse(await res.json());
    },
  });
}

export function useWorkCollection(id: number | null) {
  return useQuery({
    queryKey: [api.workCollections.get.path, id],
    enabled: typeof id === "number" && id > 0,
    queryFn: async () => {
      const url = buildUrl(api.workCollections.get.path, { id: id as number });
      const res = await fetch(url, { headers: createApiHeaders(), credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to fetch work collection");
      }
      return api.workCollections.get.responses[200].parse(await res.json());
    },
  });
}

export function useImportWorkCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: unknown) => {
      const method = api.workCollections.import.method;
      const body = JSON.stringify(payload);

      const res = await fetch(api.workCollections.import.path, {
        method,
        headers: createApiHeaders(true),
        body,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Failed to import work collection");
      }
      return api.workCollections.import.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.workCollections.list.path] });
    },
  });
}

export function useDeleteWorkCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeleteWorkCollectionInput) => {
      const baseUrl = buildUrl(api.workCollections.delete.path, { id: input.id });
      const url = input.resetSchedule ? `${baseUrl}?resetSchedule=1` : baseUrl;
      const res = await fetch(url, { method: api.workCollections.delete.method, headers: createApiHeaders(), credentials: "include" });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        const message = err.message || "Failed to delete work collection";
        const error = new Error(message) as Error & { status?: number };
        error.status = res.status;
        throw error;
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.workCollections.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.schedules.default.path] });
      queryClient.invalidateQueries({ queryKey: [api.schedules.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path] });
    },
  });
}
