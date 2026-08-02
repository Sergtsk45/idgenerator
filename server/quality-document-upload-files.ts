import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DOCUMENT_FILE_MAX_BYTES } from "./document-files";

export const QUALITY_DOCUMENT_UPLOAD_MAX_BYTES = DOCUMENT_FILE_MAX_BYTES;
export const QUALITY_DOCUMENT_PDF_MIME = "application/pdf";

export function qualityDocumentUploadsRoot(): string {
  return path.resolve(
    process.env.QUALITY_DOCUMENT_UPLOAD_DIR || path.join(process.cwd(), "uploads", "quality-documents"),
  );
}

export function isPdfFilename(filename: string): boolean {
  return path.extname(path.basename(filename)).toLowerCase() === ".pdf";
}

export function isQualityDocumentPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

export function newQualityDocumentStorageKey(): string {
  return `${randomUUID()}.pdf`;
}

export function resolveQualityDocumentUpload(storageKey: string): string {
  if (!/^[0-9a-f-]{36}\.pdf$/.test(storageKey)) throw new Error("Invalid quality document storage key");
  const root = qualityDocumentUploadsRoot();
  const filePath = path.resolve(root, storageKey);
  if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("Invalid quality document storage key");
  return filePath;
}

export async function saveQualityDocumentUpload(storageKey: string, contents: Buffer): Promise<void> {
  const filePath = resolveQualityDocumentUpload(storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, contents, { flag: "wx" });
    await link(tempPath, filePath);
    await unlink(tempPath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export function readQualityDocumentUpload(storageKey: string): Promise<Buffer> {
  return readFile(resolveQualityDocumentUpload(storageKey));
}

export function removeQualityDocumentUpload(storageKey: string): Promise<void> {
  return unlink(resolveQualityDocumentUpload(storageKey)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
