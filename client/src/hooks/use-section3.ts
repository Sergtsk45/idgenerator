import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { Section3Row } from "@shared/routes";
import { useAppSettings } from "@/lib/app-settings";

export function useSection3(options?: { enablePolling?: boolean }) {
  const enablePolling = options?.enablePolling ?? true;
  const { showWorkVolumes } = useAppSettings();

  return useQuery<Section3Row[]>({
    queryKey: [api.worklog.section3.path, showWorkVolumes],
    queryFn: async () => {
      const url = `${api.worklog.section3.path}?showVolumes=${showWorkVolumes ? "1" : "0"}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch section 3 data");
      return res.json();
    },
    refetchInterval: enablePolling ? 5000 : false,
  });
}
