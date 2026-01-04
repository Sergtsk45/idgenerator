import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertWork } from "@shared/routes";

export function useWorks() {
  return useQuery({
    queryKey: [api.works.list.path],
    queryFn: async () => {
      const res = await fetch(api.works.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch works");
      return api.works.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertWork) => {
      const res = await fetch(api.works.create.path, {
        method: api.works.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create work");
      }
      
      return api.works.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.works.list.path] });
    },
  });
}
