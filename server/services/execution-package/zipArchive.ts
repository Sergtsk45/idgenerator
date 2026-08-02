export const PACKAGE_MAX_FILES = 200;
export const PACKAGE_MAX_ENTRY_BYTES = 50 * 1024 * 1024;
export const PACKAGE_MAX_TOTAL_BYTES = 100 * 1024 * 1024;

export interface ZipEntry { name: string; contents: Buffer }

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(contents: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < contents.length; index++) crc = crcTable[(crc ^ contents[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function validateName(name: string): void {
  if (!name || name.length > 200 || name.startsWith("/") || name.includes("\\")
    || name.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Unsafe ZIP entry name");
  }
}

/** Minimal deterministic store-only ZIP; avoids a new dependency and arbitrary shell paths. */
export function buildZipArchive(entries: readonly ZipEntry[], limits: {
  maxFiles?: number;
  maxEntryBytes?: number;
  maxTotalBytes?: number;
} = {}): Buffer {
  const maxFiles = limits.maxFiles ?? PACKAGE_MAX_FILES;
  const maxEntryBytes = limits.maxEntryBytes ?? PACKAGE_MAX_ENTRY_BYTES;
  const maxTotalBytes = limits.maxTotalBytes ?? PACKAGE_MAX_TOTAL_BYTES;
  if (entries.length === 0 || entries.length > maxFiles) throw new Error("ZIP file count limit exceeded");
  const seen = new Set<string>();
  let total = 0;
  for (const entry of entries) {
    validateName(entry.name);
    if (seen.has(entry.name)) throw new Error("Duplicate ZIP entry name");
    seen.add(entry.name);
    if (entry.contents.length > maxEntryBytes) throw new Error("ZIP entry size limit exceeded");
    total += entry.contents.length;
    if (total > maxTotalBytes) throw new Error("ZIP total size limit exceeded");
  }

  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.contents);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.contents.length, 18);
    local.writeUInt32LE(entry.contents.length, 22);
    local.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(0, 10);
    directory.writeUInt16LE(0, 12);
    directory.writeUInt16LE(0x21, 14);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(entry.contents.length, 20);
    directory.writeUInt32LE(entry.contents.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    locals.push(local, name, entry.contents);
    central.push(directory, name);
    offset += local.length + name.length + entry.contents.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}
