import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export function executionPackagesRoot(): string {
  return path.resolve(process.env.EXECUTION_PACKAGES_DIR || path.join(process.cwd(), "generated_pdfs", "packages"));
}

export function newExecutionPackageStorageKey(): string { return `${randomUUID()}.zip`; }

export function resolveExecutionPackageFile(storageKey: string): string {
  if (!/^[0-9a-f-]{36}\.zip$/.test(storageKey)) throw new Error("Invalid execution package storage key");
  const root = executionPackagesRoot();
  const file = path.resolve(root, storageKey);
  if (!file.startsWith(`${root}${path.sep}`)) throw new Error("Invalid execution package storage key");
  return file;
}

export async function saveExecutionPackageFile(storageKey: string, contents: Buffer): Promise<void> {
  const file = resolveExecutionPackageFile(storageKey);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, contents, { flag: "wx" });
    await link(temporary, file);
    await unlink(temporary);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export function readExecutionPackageFile(storageKey: string) { return readFile(resolveExecutionPackageFile(storageKey)); }
export function removeExecutionPackageFile(storageKey: string) {
  return unlink(resolveExecutionPackageFile(storageKey)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
