import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { Section3Row } from "@shared/routes";
import { useAppSettings } from "@/lib/app-settings";
import { getTelegramInitData } from "@/lib/telegram";
import { getBrowserAccessToken } from "@/lib/browser-access";

function createHeaders(): HeadersInit {
  const headers: HeadersInit = {};

  const initData = getTelegramInitData();
  if (initData) headers["X-Telegram-Init-Data"] = initData;

  const accessToken = getBrowserAccessToken();
  if (accessToken) headers["X-App-Access-Token"] = accessToken;

  return headers;
}

export function useSection3(options?: { enablePolling?: boolean }) {
  const enablePolling = options?.enablePolling ?? true;
  const { showWorkVolumes } = useAppSettings();

  return useQuery<Section3Row[]>({
    queryKey: [api.worklog.section3.path, showWorkVolumes],
    queryFn: async () => {
      const url = `${api.worklog.section3.path}?showVolumes=${showWorkVolumes ? "1" : "0"}`;
      const res = await fetch(url, {
        headers: createHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to fetch section 3 data");
      }
      return res.json();
    },
    refetchInterval: enablePolling ? 5000 : false,
  });
}
