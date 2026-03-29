/**
 * @file: use-documents.ts
 * @description: React Query hooks для реестра документов качества и привязок.
 * @dependencies: @shared/routes, @tanstack/react-query
 * @created: 2026-02-01
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertDocument, type InsertDocumentBinding } from "@shared/routes";

export function useDocuments(params?: { query?: string; docType?: string; scope?: string }) {
  const query = String(params?.query ?? "");
  const docType = params?.docType ? String(params.docType) : "";
  const scope = params?.scope ? String(params.scope) : "";

  return useQuery({
    queryKey: [api.documents.list.path, query, docType, scope],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (query) qs.set("query", query);
      if (docType) qs.set("docType", docType);
      if (scope) qs.set("scope", scope);
      const url = `${api.documents.list.path}?${qs.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return api.documents.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertDocument) => {
      const res = await fetch(api.documents.create.path, {
        method: api.documents.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create document");
      }
      return api.documents.create.responses[201].parse(await res.json());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [api.documents.list.path] });
    },
  });
}

export function useCreateDocumentBinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertDocumentBinding) => {
      const res = await fetch(api.documentBindings.create.path, {
        method: api.documentBindings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create document binding");
      }
      return api.documentBindings.create.responses[201].parse(await res.json());
    },
    onSuccess: async (_data, variables) => {
      // Refresh material detail if binding is material-scoped
      if ((variables as any).projectMaterialId) {
        await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.get.path, Number((variables as any).projectMaterialId)] });
      }
      await queryClient.invalidateQueries({ queryKey: [api.documents.list.path] });
      await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path] });
    },
  });
}

export function usePatchDocumentBinding(projectMaterialId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: number; patch: Record<string, unknown> }) => {
      const url = buildUrl(api.documentBindings.patch.path, { id: args.id });
      const res = await fetch(url, {
        method: api.documentBindings.patch.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.patch),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update document binding");
      }
      return api.documentBindings.patch.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      if (projectMaterialId) await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.get.path, projectMaterialId] });
      await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path] });
    },
  });
}

export function useDeleteDocumentBinding(projectMaterialId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bindingId: number) => {
      const url = buildUrl(api.documentBindings.delete.path, { id: bindingId });
      const res = await fetch(url, { method: api.documentBindings.delete.method, credentials: "include" });
      if (!res.ok && res.status !== 204) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete document binding");
      }
      return true;
    },
    onSuccess: async () => {
      if (projectMaterialId) await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.get.path, projectMaterialId] });
      await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path] });
    },
  });
}

