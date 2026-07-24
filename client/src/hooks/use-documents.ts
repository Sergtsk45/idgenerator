/**
 * @file: use-documents.ts
 * @description: React Query hooks для реестра документов качества и привязок.
 * @dependencies: @shared/routes, @tanstack/react-query
 * @created: 2026-02-01
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertDocument, type InsertDocumentBinding } from "@shared/routes";
import { createApiHeaders } from "@/lib/api-headers";
import { apiRequest } from "@/lib/queryClient";
import { useCurrentObject } from "@/hooks/use-source-data";

type DocumentViewMode = "project" | "global" | "all";
type DocumentScope = "project" | "global";

type DocumentPatch = {
  docType?: string;
  title?: string | null;
  docNumber?: string | null;
  docDate?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  fileUrl?: string | null;
};

export type ApiError = Error & { status?: number };

export function createApiError(message: string, status?: number): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  return error;
}

function documentsQueryKey(objectId?: number, params?: { query?: string; docType?: string; viewMode?: DocumentViewMode }) {
  return [
    api.documents.list.path,
    objectId ?? null,
    String(params?.query ?? ""),
    params?.docType ? String(params.docType) : "",
    params?.viewMode ?? "project",
  ] as const;
}

async function invalidateDocuments(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: [api.documents.list.path] });
}

export function useDocuments(params?: { query?: string; docType?: string; viewMode?: DocumentViewMode }) {
  const currentObjectQuery = useCurrentObject();
  const objectId = (currentObjectQuery.data as any)?.id as number | undefined;
  const query = String(params?.query ?? "");
  const docType = params?.docType ? String(params.docType) : "";
  const viewMode = params?.viewMode ?? "project";

  return useQuery({
    queryKey: documentsQueryKey(objectId, { query, docType, viewMode }),
    enabled: Boolean(objectId),
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (query) qs.set("query", query);
      if (docType) qs.set("docType", docType);
      qs.set("viewMode", viewMode);
      const url = `${api.documents.list.path}?${qs.toString()}`;
      const res = await fetch(url, {
        credentials: "include",
        headers: createApiHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return api.documents.list.responses[200].parse(await res.json());
    },
  });
}

export function useDeleteDocument(projectMaterialId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: number) => {
      const url = buildUrl(api.documents.delete.path, { id: documentId });
      const res = await fetch(url, {
        method: api.documents.delete.method,
        credentials: "include",
        headers: createApiHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw createApiError(errorData.message || "Failed to delete document", res.status);
      }
      return true;
    },
    onSuccess: async () => {
      await invalidateDocuments(queryClient);
      await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path] });
      if (projectMaterialId) {
        await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.get.path, projectMaterialId] });
      }
    },
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<InsertDocument, "objectId"> & { viewMode?: DocumentViewMode }) => {
      const { viewMode: _viewMode, ...payload } = data as any;
      if (!payload.scope && (_viewMode === "project" || _viewMode === "global")) {
        payload.scope = _viewMode;
      }
      const res = await fetch(api.documents.create.path, {
        method: api.documents.create.method,
        headers: createApiHeaders(true),
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create document");
      }
      return api.documents.create.responses[201].parse(await res.json());
    },
    onSuccess: async () => {
      await invalidateDocuments(queryClient);
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: number; patch: DocumentPatch }) => {
      const url = buildUrl(api.documents.patch.path, { id: args.id });
      const res = await fetch(url, {
        method: api.documents.patch.method,
        headers: createApiHeaders(true),
        body: JSON.stringify(args.patch),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update document");
      }
      return api.documents.patch.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      await invalidateDocuments(queryClient);
    },
  });
}

export function useSetDocumentScope() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: number; scope: DocumentScope }) => {
      const url = buildUrl(api.documents.setScope.path, { id: args.id });
      const res = await fetch(url, {
        method: api.documents.setScope.method,
        headers: createApiHeaders(true),
        body: JSON.stringify({ scope: args.scope }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update document scope");
      }
      return api.documents.setScope.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      await invalidateDocuments(queryClient);
      await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path] });
    },
  });
}

export function useCreateDocumentBinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertDocumentBinding) => {
      const res = await fetch(api.documentBindings.create.path, {
        method: api.documentBindings.create.method,
        headers: createApiHeaders(true),
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
      await invalidateDocuments(queryClient);
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
        headers: createApiHeaders(true),
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
      await invalidateDocuments(queryClient);
    },
  });
}

export function useDeleteDocumentBinding(projectMaterialId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bindingId: number) => {
      const url = buildUrl(api.documentBindings.delete.path, { id: bindingId });
      await apiRequest(api.documentBindings.delete.method, url);
      return true;
    },
    onSuccess: async () => {
      if (projectMaterialId) await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.get.path, projectMaterialId] });
      await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path] });
      await invalidateDocuments(queryClient);
    },
  });
}
