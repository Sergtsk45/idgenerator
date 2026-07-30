import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const DOCUMENT_FILE_MAX_BYTES = 50 * 1024 * 1024;

export function documentsUploadRoot(): string {
  return path.resolve(process.env.DOCUMENTS_UPLOAD_DIR || path.join(process.cwd(), "uploads", "documents"));
}

export function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF";
}

export function documentFilename(documentId: number, originalName: string): string {
  const stem = path
    .basename(originalName, path.extname(originalName))
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100) || "document";
  return `${documentId}_${stem}_${randomUUID().slice(0, 8)}.pdf`;
}

export function documentFileUrl(objectId: number, filename: string): string {
  return `/api/documents/files/${objectId}/${filename}`;
}

export function resolveDocumentFile(objectId: number, filename: string): string {
  if (!Number.isInteger(objectId) || objectId <= 0 || !/^\d+_[a-zA-Z0-9_-]+\.pdf$/.test(filename)) {
    throw new Error("Invalid document file path");
  }
  const objectRoot = path.resolve(documentsUploadRoot(), String(objectId));
  const filePath = path.resolve(objectRoot, filename);
  if (!filePath.startsWith(`${objectRoot}${path.sep}`)) throw new Error("Invalid document file path");
  return filePath;
}

export async function saveDocumentFile(objectId: number, filename: string, contents: Buffer): Promise<string> {
  const filePath = resolveDocumentFile(objectId, filename);
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, contents, { flag: "wx" });
    await rename(tempPath, filePath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
  return filePath;
}

export async function removeDocumentFile(fileUrl: string | null | undefined): Promise<void> {
  const match = /^\/api\/documents\/files\/(\d+)\/([^/]+)$/.exec(fileUrl || "");
  if (!match) return;
  await unlink(resolveDocumentFile(Number(match[1]), match[2])).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
