/**
 * @file: use-objects.ts
 * @description: React Query хуки для управления несколькими объектами строительства
 * @dependencies: @shared/routes, @tanstack/react-query, use-source-data, api-headers
 * @created: 2026-03-07
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { createApiHeaders } from "../lib/api-headers";
import { CURRENT_OBJECT_QUERY_KEY } from "./use-source-data";

export function useObjects() {
  return useQuery({
    queryKey: ["objects"],
    queryFn: async () => {
      const res = await fetch(api.objects.list.path, {
        credentials: "include",
        headers: createApiHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch objects");
      return api.objects.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateObject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; address?: string; city?: string }) => {
      const res = await fetch(api.objects.create.path, {
        method: api.objects.create.method,
        headers: createApiHeaders(true),
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Failed to create object");
      }
      return api.objects.create.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      // Creating an object also makes it current on the server, so every
      // object-scoped query must be reloaded before the mutation completes.
      await queryClient.invalidateQueries();
    },
  });
}

export function useUpdateObject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      objectId,
      data,
    }: {
      objectId: number;
      data: { title?: string; address?: string | null; city?: string | null };
    }) => {
      const url = buildUrl(api.objects.update.path, { objectId });
      const res = await fetch(url, {
        method: api.objects.update.method,
        headers: createApiHeaders(true),
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update object");
      }
      return api.objects.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["objects"] });
      queryClient.invalidateQueries({ queryKey: CURRENT_OBJECT_QUERY_KEY });
    },
  });
}

export function useDeleteObject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (objectId: number) => {
      const url = buildUrl(api.objects.delete.path, { objectId });
      const res = await fetch(url, {
        method: api.objects.delete.method,
        headers: createApiHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete object");
      }
    },
    onSuccess: () => {
      // После удаления текущий объект может измениться — сбрасываем весь кеш
      queryClient.invalidateQueries();
    },
  });
}

export function useSelectObject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (objectId: number) => {
      const url = buildUrl(api.objects.select.path, { objectId });
      const res = await fetch(url, {
        method: api.objects.select.method,
        headers: createApiHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to select object");
      }
      return api.objects.select.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      // Все данные привязаны к объекту — сбрасываем весь кеш
      queryClient.invalidateQueries();
    },
  });
}
