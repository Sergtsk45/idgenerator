import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type GenerateActRequest } from "@shared/routes";

export function useActs() {
  return useQuery({
    queryKey: [api.acts.list.path],
    queryFn: async () => {
      const res = await fetch(api.acts.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch acts");
      return api.acts.list.responses[200].parse(await res.json());
    },
  });
}

export function useAct(id: number) {
  return useQuery({
    queryKey: [api.acts.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.acts.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch act details");
      return api.acts.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useGenerateAct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: GenerateActRequest) => {
      const res = await fetch(api.acts.generate.path, {
        method: api.acts.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate act");
      }
      
      return api.acts.generate.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.acts.list.path] });
    },
  });
}
