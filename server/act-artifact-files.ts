import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export function actArtifactsRoot(): string {
  return path.resolve(process.env.ACT_ARTIFACTS_DIR || path.join(process.cwd(), "generated_pdfs", "artifacts"));
}

export function newActArtifactStorageKey(): string {
  return `${randomUUID()}.pdf`;
}

export function resolveActArtifactFile(storageKey: string): string {
  if (!/^[0-9a-f-]{36}\.pdf$/.test(storageKey)) throw new Error("Invalid act artifact storage key");
  const root = actArtifactsRoot();
  const filePath = path.resolve(root, storageKey);
  if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("Invalid act artifact storage key");
  return filePath;
}

export async function saveActArtifactFile(storageKey: string, contents: Buffer): Promise<void> {
  const filePath = resolveActArtifactFile(storageKey);
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

export function readActArtifactFile(storageKey: string): Promise<Buffer> {
  return readFile(resolveActArtifactFile(storageKey));
}

export function removeActArtifactFile(storageKey: string): Promise<void> {
  return unlink(resolveActArtifactFile(storageKey)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
