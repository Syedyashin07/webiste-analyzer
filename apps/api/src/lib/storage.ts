import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { STORAGE_ROOT } from "../config.js";
import { prisma } from "./prisma.js";

export interface StoredFile {
  storageKey: string;
  filePath: string;
}

function assertSafeKey(key: string): string {
  const normalized = key.replaceAll("\\", "/");
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid storage key");
  }
  const resolved = path.resolve(STORAGE_ROOT, normalized);
  const root = path.resolve(STORAGE_ROOT);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Path traversal blocked");
  }
  return resolved;
}

export async function saveBuffer(storageKey: string, data: Buffer, mimeType = "application/octet-stream"): Promise<StoredFile> {
  const filePath = assertSafeKey(storageKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
  await upsertFileBlob(storageKey, data, mimeType);
  await fs.unlink(filePath).catch(() => undefined);
  return { storageKey, filePath };
}

export async function ensureDir(storageKeyDir: string): Promise<string> {
  const dir = assertSafeKey(storageKeyDir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function resolveStorageKey(storageKey: string): string {
  return assertSafeKey(storageKey);
}

export function scanFileKey(kind: "screenshots" | "videos" | "traces" | "reports", scanId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${kind}/${scanId}/${safe}`;
}

export async function upsertFileBlob(storageKey: string, data: Buffer, mimeType: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "FileBlob" ("id", "storageKey", "mimeType", "bytes", "byteSize", "createdAt")
    VALUES (${randomUUID()}, ${storageKey}, ${mimeType}, ${data}, ${data.length}, NOW())
    ON CONFLICT ("storageKey")
    DO UPDATE SET "mimeType" = EXCLUDED."mimeType", "bytes" = EXCLUDED."bytes", "byteSize" = EXCLUDED."byteSize"
  `;
}

export async function ingestStoredFile(storageKey: string, filePath: string, mimeType: string): Promise<Buffer | null> {
  try {
    const data = await fs.readFile(filePath);
    if (data.length === 0) return null;
    await upsertFileBlob(storageKey, data, mimeType);
    await fs.unlink(filePath).catch(() => undefined);
    return data;
  } catch {
    return null;
  }
}

export async function readStoredFile(storageKey: string, mimeType = "application/octet-stream"): Promise<Buffer | null> {
  const rows = await prisma.$queryRaw<Array<{ bytes: Uint8Array | Buffer }>>`
    SELECT "bytes" FROM "FileBlob" WHERE "storageKey" = ${storageKey} LIMIT 1
  `;
  const blob = rows[0]?.bytes;
  if (blob) return Buffer.from(blob);

  try {
    const filePath = resolveStorageKey(storageKey);
    const data = await fs.readFile(filePath);
    if (data.length === 0) return null;
    await upsertFileBlob(storageKey, data, mimeType).catch(() => undefined);
    await fs.unlink(filePath).catch(() => undefined);
    return data;
  } catch {
    return null;
  }
}

export async function removeScanFiles(scanId: string): Promise<void> {
  const buckets = ["screenshots", "videos", "traces", "reports"] as const;
  for (const bucket of buckets) {
    const prefix = `${bucket}/${scanId}/%`;
    await prisma.$executeRaw`DELETE FROM "FileBlob" WHERE "storageKey" LIKE ${prefix}`;
    const dir = path.join(STORAGE_ROOT, bucket, scanId);
    const root = path.resolve(STORAGE_ROOT);
    if (!path.resolve(dir).startsWith(root + path.sep)) continue;
    await fs.rm(dir, { recursive: true, force: true });
  }
}
