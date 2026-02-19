import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateMessageRequest } from "@shared/routes";

export function useMessages() {
  return useQuery({
    queryKey: [api.messages.list.path],
    queryFn: async () => {
      const res = await fetch(api.messages.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to send message");
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
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Failed to process message");
      }
      
      return api.messages.process.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path] });
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to patch message");
      }
      
      return api.messages.patch.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.messages.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.worklog.section3.path] });
    },
  });
}
