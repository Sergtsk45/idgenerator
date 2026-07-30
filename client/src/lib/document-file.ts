import { createApiHeaders } from "@/lib/api-headers";

export async function openDocumentFile(fileUrl: string): Promise<void> {
  const url = new URL(fileUrl, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/documents/files/")) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const popup = window.open("", "_blank");
  if (popup) popup.opener = null;
  try {
    const response = await fetch(url, {
      credentials: "include",
      headers: createApiHeaders(),
    });
    if (!response.ok) throw new Error(response.status === 401 ? "Требуется авторизация" : "Не удалось открыть PDF");
    const blobUrl = URL.createObjectURL(await response.blob());
    if (popup) {
      popup.location.href = blobUrl;
    } else {
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    }
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}
