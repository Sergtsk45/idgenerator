/**
 * @file: use-admin.ts
 * @description: React Query хуки для административной панели
 * @dependencies: queryClient.ts, @tanstack/react-query
 * @created: 2026-02-23
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getTelegramInitData } from "@/lib/telegram";
import { getBrowserAccessToken } from "@/lib/browser-access";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminUserRow {
  telegramUserId: string;
  objectId: number | null;
  objectTitle: string | null;
  isBlocked: boolean;
  isAdmin: boolean;
  objectsCount: number;
  actsCount: number;
  messagesCount: number;
}

export interface AdminStats {
  totalUsers: number;
  totalObjects: number;
  totalActs: number;
  totalMessages: number;
  processedMessages: number;
  failedMessages: number;
  totalMaterials: number;
}

export interface AdminMessage {
  id: number;
  messageRaw: string;
  isProcessed: boolean;
  normalizedData: unknown;
  createdAt: string;
  userId: string;
  objectId: number | null;
}

export interface CatalogMaterial {
  id: number;
  name: string;
  baseUnit: string | null;
  standardRef: string | null;
  category: string | null;
}

// ── Admin header helper ───────────────────────────────────────────────────────

/** В dev-режиме добавляет X-Admin-Override: true для обхода проверки */
function adminHeaders(): HeadersInit {
  const isDev = import.meta.env.DEV;
  const headers: Record<string, string> = {};

  if (isDev) headers["X-Admin-Override"] = "true";

  const initData = getTelegramInitData();
  if (initData) headers["X-Telegram-Init-Data"] = initData;

  const accessToken = getBrowserAccessToken();
  if (accessToken) headers["X-App-Access-Token"] = accessToken;

  return headers;
}

async function adminFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      ...adminHeaders(),
    },
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function adminMutate(method: string, url: string, body?: unknown): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders(),
    },
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => adminFetch<AdminStats>("/api/admin/stats"),
    refetchInterval: 30_000,
  });
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function useAdminUsers() {
  return useQuery<AdminUserRow[]>({
    queryKey: ["admin", "users"],
    queryFn: () => adminFetch<AdminUserRow[]>("/api/admin/users"),
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (telegramUserId: string) =>
      adminMutate("POST", `/api/admin/users/${telegramUserId}/block`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (telegramUserId: string) =>
      adminMutate("POST", `/api/admin/users/${telegramUserId}/unblock`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useMakeAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (telegramUserId: string) =>
      adminMutate("POST", `/api/admin/users/${telegramUserId}/make-admin`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useRemoveAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (telegramUserId: string) =>
      adminMutate("DELETE", `/api/admin/users/${telegramUserId}/admin`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

// ── Messages queue ─────────────────────────────────────────────────────────────

export function useFailedMessages() {
  return useQuery<AdminMessage[]>({
    queryKey: ["admin", "messages", "failed"],
    queryFn: () => adminFetch<AdminMessage[]>("/api/admin/messages/failed"),
  });
}

export function useReprocessMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminMutate("POST", `/api/admin/messages/${id}/reprocess`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "messages", "failed"] }),
  });
}

// ── Materials catalog ──────────────────────────────────────────────────────────

export function useAdminMaterials() {
  return useQuery<CatalogMaterial[]>({
    queryKey: ["admin", "materials-catalog"],
    queryFn: () => adminFetch<CatalogMaterial[]>("/api/materials-catalog"),
  });
}

export function useAdminCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; unit?: string; gostTu?: string; description?: string }) =>
      adminMutate("POST", "/api/admin/materials-catalog", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "materials-catalog"] }),
  });
}

export function useAdminUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number;
      name?: string;
      unit?: string;
      gostTu?: string;
      description?: string;
    }) => adminMutate("PATCH", `/api/admin/materials-catalog/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "materials-catalog"] }),
  });
}

export function useAdminDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminMutate("DELETE", `/api/admin/materials-catalog/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "materials-catalog"] }),
  });
}

export function useAdminImportMaterials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      mode: "merge" | "replace";
      items: Array<{
        name: string;
        unit?: string;
        gostTu?: string;
        category?: "material" | "equipment" | "product";
      }>;
    }) => {
      const res = await adminMutate("POST", "/api/admin/materials-catalog/import", data);
      return res.json() as Promise<{
        received: number;
        created: number;
        updated: number;
        skipped: number;
      }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "materials-catalog"] });
    },
  });
}
