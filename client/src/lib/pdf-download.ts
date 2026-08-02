/**
 * @file: pdf-download.ts
 * @description: Утилиты безопасного скачивания/открытия PDF в браузере и Telegram WebApp.
 * @dependencies: @/lib/telegram
 * @created: 2026-07-22
 */

import { apiRequest } from "@/lib/queryClient";

export function withDownloadQuery(url: string): string {
  return url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
}

export async function openPdfDownload(url: string, filename?: string) {
  const downloadUrl = withDownloadQuery(url);
  const response = await apiRequest("GET", downloadUrl);
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    if (filename) a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}
