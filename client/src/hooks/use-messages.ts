import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateMessageRequest } from "@shared/routes";
import { getTelegramInitData } from "@/lib/telegram";

function createHeaders(includeContentType: boolean): HeadersInit {
  const headers: HeadersInit = {};

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  const initData = getTelegramInitData();
  if (initData) {
    headers["X-Telegram-Init-Data"] = initData;
  }

  return headers;
}

async function readApiError(res: Response): Promise<string> {
  const contentType = String(res.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    const data = (await res.json().catch(() => null)) as any;
    const msg =
      (data && typeof data === "object" && (data.message || data.error)) || null;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }

  const text = await res.text().catch(() => "");
  const trimmed = String(text || "").trim();
  if (trimmed) return trimmed;

  return res.statusText || `HTTP ${res.status}`;
}

export function useMessages() {
  return useQuery({
    queryKey: [api.messages.list.path],
    queryFn: async () => {
      const res = await fetch(api.messages.list.path, {
        headers: createHeaders(false),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await readApiError(res));
      return api.messages.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000, // Poll for updates on processed status
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateMessageRequest) => {
      const res = await fetch(api.messages.create.path, {
        method: api.messages.create.method,
        headers: createHeaders(true),
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      
      return api.messages.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path] });
    },
  });
}

export function useProcessMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.messages.process.path, { id });
      const res = await fetch(url, {
        method: api.messages.process.method,
        headers: createHeaders(false),
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      
      return api.messages.process.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path] });
    },
  });
}

export function useClearMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.messages.list.path, {
        method: "DELETE",
        headers: createHeaders(false),
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(await readApiError(res));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.worklog.section3.path] });
    },
  });
}

export function usePatchMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { messageRaw?: string; normalizedData?: any } }) => {
      const url = buildUrl(api.messages.patch.path, { id });
      const res = await fetch(url, {
        method: api.messages.patch.method,
        headers: createHeaders(true),
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      
      return api.messages.patch.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.worklog.section3.path] });
    },
  });
}
