/**
 * @file: use-act-materials.ts
 * @description: React Query hooks для управления материалами п.3 АОСР и приложениями (act_material_usages / act_document_attachments).
 * @dependencies: @shared/routes, @tanstack/react-query
 * @created: 2026-02-01
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertActDocumentAttachment, type InsertActMaterialUsage } from "@shared/routes";
import { createApiHeaders } from "@/lib/api-headers";

export function useActMaterialUsages(actId?: number) {
  return useQuery({
    queryKey: [api.actMaterialUsages.list.path, actId],
    enabled: Number.isFinite(actId) && (actId as number) > 0,
    queryFn: async () => {
      const url = buildUrl(api.actMaterialUsages.list.path, { id: actId as number });
      const res = await fetch(url, { credentials: "include", headers: createApiHeaders() });
      if (!res.ok) throw new Error("Failed to fetch act material usages");
      return api.actMaterialUsages.list.responses[200].parse(await res.json());
    },
  });
}

export function useReplaceActMaterialUsages(actId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<Omit<InsertActMaterialUsage, "actId">>) => {
      const url = buildUrl(api.actMaterialUsages.replace.path, { id: actId });
      const res = await fetch(url, {
        method: api.actMaterialUsages.replace.method,
        headers: createApiHeaders(true),
        body: JSON.stringify({ items }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to replace act material usages");
      }
      return api.actMaterialUsages.replace.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [api.actMaterialUsages.list.path, actId] });
    },
  });
}

export function useActDocumentAttachments(actId?: number) {
  return useQuery({
    queryKey: [api.actDocumentAttachments.list.path, actId],
    enabled: Number.isFinite(actId) && (actId as number) > 0,
    queryFn: async () => {
      const url = buildUrl(api.actDocumentAttachments.list.path, { id: actId as number });
      const res = await fetch(url, { credentials: "include", headers: createApiHeaders() });
      if (!res.ok) throw new Error("Failed to fetch act document attachments");
      return api.actDocumentAttachments.list.responses[200].parse(await res.json());
    },
  });
}

export function useReplaceActDocumentAttachments(actId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      items: Array<Omit<InsertActDocumentAttachment, "actId">>;
      markManual?: boolean;
    }) => {
      const url = buildUrl(api.actDocumentAttachments.replace.path, { id: actId });
      const res = await fetch(url, {
        method: api.actDocumentAttachments.replace.method,
        headers: createApiHeaders(true),
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to replace act document attachments");
      }
      return api.actDocumentAttachments.replace.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [api.actDocumentAttachments.list.path, actId] });
      await queryClient.invalidateQueries({ queryKey: [api.acts.get.path, actId] });
    },
  });
}

export function useResetActDocumentAttachments(actId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const url = buildUrl(api.actDocumentAttachments.resetFromUsages.path, { id: actId });
      const res = await fetch(url, {
        method: api.actDocumentAttachments.resetFromUsages.method,
        headers: createApiHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to reset act document attachments");
      }
      return api.actDocumentAttachments.resetFromUsages.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [api.actDocumentAttachments.list.path, actId] });
      await queryClient.invalidateQueries({ queryKey: [api.acts.get.path, actId] });
    },
  });
}

