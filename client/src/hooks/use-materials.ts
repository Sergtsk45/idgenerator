/**
 * @file: use-materials.ts
 * @description: React Query hooks для материалов (справочник + материалы объекта + партии/поставки).
 * @dependencies: @shared/routes, @tanstack/react-query
 * @created: 2026-02-01
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertMaterialBatch, type InsertProjectMaterial } from "@shared/routes";

export function useMaterialsCatalogSearch(query?: string) {
  const q = String(query ?? "");
  return useQuery({
    queryKey: [api.materialsCatalog.search.path, q],
    queryFn: async () => {
      const url = `${api.materialsCatalog.search.path}?query=${encodeURIComponent(q)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch materials catalog");
      return api.materialsCatalog.search.responses[200].parse(await res.json());
    },
  });
}

export function useProjectMaterials(objectId?: number) {
  return useQuery({
    queryKey: [api.projectMaterials.list.path, objectId],
    enabled: Number.isFinite(objectId) && (objectId as number) > 0,
    queryFn: async () => {
      const url = buildUrl(api.projectMaterials.list.path, { objectId: objectId as number });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch project materials");
      return api.projectMaterials.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateProjectMaterial(objectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<InsertProjectMaterial> & { catalogMaterialId?: number }) => {
      const url = buildUrl(api.projectMaterials.create.path, { objectId });
      const res = await fetch(url, {
        method: api.projectMaterials.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create project material");
      }
      return api.projectMaterials.create.responses[201].parse(await res.json());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path, objectId] });
    },
  });
}

export function useProjectMaterial(id?: number) {
  return useQuery({
    queryKey: [api.projectMaterials.get.path, id],
    enabled: Number.isFinite(id) && (id as number) > 0,
    queryFn: async () => {
      const url = buildUrl(api.projectMaterials.get.path, { id: id as number });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch project material");
      return api.projectMaterials.get.responses[200].parse(await res.json());
    },
  });
}

export function usePatchProjectMaterial(materialId: number, objectId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const url = buildUrl(api.projectMaterials.patch.path, { id: materialId });
      const res = await fetch(url, {
        method: api.projectMaterials.patch.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update project material");
      }
      return api.projectMaterials.patch.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.get.path, materialId] });
      if (objectId) await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path, objectId] });
    },
  });
}

export function useSaveProjectMaterialToCatalog(materialId: number, objectId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const url = buildUrl(api.projectMaterials.saveToCatalog.path, { id: materialId });
      const res = await fetch(url, {
        method: api.projectMaterials.saveToCatalog.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save material to catalog");
      }
      return api.projectMaterials.saveToCatalog.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.get.path, materialId] });
      if (objectId) await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path, objectId] });
      await queryClient.invalidateQueries({ queryKey: [api.materialsCatalog.search.path] });
    },
  });
}

export function useCreateBatch(projectMaterialId: number, objectId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<InsertMaterialBatch, "objectId" | "projectMaterialId">) => {
      const url = buildUrl(api.materialBatches.create.path, { id: projectMaterialId });
      const res = await fetch(url, {
        method: api.materialBatches.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create batch");
      }
      return api.materialBatches.create.responses[201].parse(await res.json());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.get.path, projectMaterialId] });
      if (objectId) await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path, objectId] });
    },
  });
}

export function usePatchBatch(batchId: number, projectMaterialId?: number, objectId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const url = buildUrl(api.materialBatches.patch.path, { id: batchId });
      const res = await fetch(url, {
        method: api.materialBatches.patch.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update batch");
      }
      return api.materialBatches.patch.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      if (projectMaterialId) await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.get.path, projectMaterialId] });
      if (objectId) await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path, objectId] });
    },
  });
}

export function useDeleteBatch(batchId: number, projectMaterialId?: number, objectId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const url = buildUrl(api.materialBatches.delete.path, { id: batchId });
      const res = await fetch(url, { method: api.materialBatches.delete.method, credentials: "include" });
      if (!res.ok && res.status !== 204) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete batch");
      }
      return true;
    },
    onSuccess: async () => {
      if (projectMaterialId) await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.get.path, projectMaterialId] });
      if (objectId) await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path, objectId] });
    },
  });
}

export function useParseInvoice(objectId: number) {
  return useMutation({
    mutationFn: async (file: File) => {
      const url = buildUrl(api.projectMaterials.parseInvoice.path, { objectId });
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(url, {
        method: api.projectMaterials.parseInvoice.method,
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to parse invoice");
      }
      return api.projectMaterials.parseInvoice.responses[200].parse(await res.json());
    },
  });
}

export function useBulkCreateMaterials(objectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ nameOverride: string; baseUnitOverride?: string }>) => {
      const url = buildUrl(api.projectMaterials.bulkCreate.path, { objectId });
      const res = await fetch(url, {
        method: api.projectMaterials.bulkCreate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to bulk create materials");
      }
      return api.projectMaterials.bulkCreate.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [api.projectMaterials.list.path, objectId] });
    },
  });
}

