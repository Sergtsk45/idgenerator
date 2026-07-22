/**
 * @file: pdf-download.ts
 * @description: Утилиты безопасного скачивания/открытия PDF в браузере и Telegram WebApp.
 * @dependencies: @/lib/telegram
 * @created: 2026-07-22
 */

import { isTelegramWebAppAvailable } from "@/lib/telegram";

export function withDownloadQuery(url: string): string {
  return url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
}

export function openPdfDownload(url: string, filename?: string) {
  const downloadUrl = withDownloadQuery(url);
  const absoluteUrl = new URL(downloadUrl, window.location.origin).toString();

  if (isTelegramWebAppAvailable() && window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(absoluteUrl, { try_instant_view: false });
    return;
  }

  try {
    const a = document.createElement("a");
    a.href = absoluteUrl;
    if (filename) a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    window.open(absoluteUrl, "_blank", "noopener,noreferrer");
  }
}
