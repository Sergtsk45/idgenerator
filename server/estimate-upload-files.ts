import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const ESTIMATE_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const ESTIMATE_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function estimateUploadsRoot(): string {
  return path.resolve(process.env.ESTIMATE_UPLOAD_DIR || path.join(process.cwd(), "uploads", "estimates"));
}

export function isXlsxFilename(filename: string): boolean {
  return path.extname(path.basename(filename)).toLowerCase() === ".xlsx";
}

export function isXlsx(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

export function newEstimateStorageKey(): string {
  return `${randomUUID()}.xlsx`;
}

export function resolveEstimateUpload(storageKey: string): string {
  if (!/^[0-9a-f-]{36}\.xlsx$/.test(storageKey)) throw new Error("Invalid estimate storage key");
  const root = estimateUploadsRoot();
  const filePath = path.resolve(root, storageKey);
  if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("Invalid estimate storage key");
  return filePath;
}

export async function saveEstimateUpload(storageKey: string, contents: Buffer): Promise<void> {
  const filePath = resolveEstimateUpload(storageKey);
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

export function readEstimateUpload(storageKey: string): Promise<Buffer> {
  return readFile(resolveEstimateUpload(storageKey));
}

export function removeEstimateUpload(storageKey: string): Promise<void> {
  return unlink(resolveEstimateUpload(storageKey)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
