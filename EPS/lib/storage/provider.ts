import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile, access, readFile } from "fs/promises";
import { constants } from "fs";
import { isAbsolute, join, normalize } from "path";
import { readProjectSettings } from "@/lib/settings/store";

export type StoreInput = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
};

export type StoredFile = {
  fileName: string;
  storagePath: string;
  checksum: string;
};

const allowedMimeTypes = new Set(
  (process.env.ALLOWED_UPLOAD_MIME_TYPES || "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);
const maxBytes = Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024);
const uploadsRoot = join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads");
const networkRoot = join(/* turbopackIgnore: true */ process.cwd(), "data", "network-drive");

async function getLocalStorageRoot() {
  const settings = await readProjectSettings();
  if (settings.storage.localMode === "NETWORK_DRIVE") {
    const rawPath = settings.storage.networkDiskPath?.trim();
    if (!rawPath) return uploadsRoot;
    return isAbsolute(rawPath) ? rawPath : join(networkRoot, safeRelativePath(rawPath));
  }
  return uploadsRoot;
}

function validateFile(input: StoreInput) {
  if (input.bytes.byteLength > maxBytes) {
    throw new Error(`File is too large. Max ${maxBytes} bytes`);
  }
  if (allowedMimeTypes.size && !allowedMimeTypes.has(input.mimeType)) {
    throw new Error(`Unsupported file type: ${input.mimeType}`);
  }
}

function safeRelativePath(value: string) {
  const normalized = normalize(value).replace(/^([/\\])+/, "");
  if (normalized.includes("..")) {
    throw new Error("Invalid storage path");
  }
  return normalized;
}

export async function storeLocalFile(input: StoreInput): Promise<StoredFile> {
  validateFile(input);
  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  const root = await getLocalStorageRoot();

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const relDir = join(year, month);
  const absDir = join(root, relDir);
  await mkdir(absDir, { recursive: true });

  const storedName = `${randomUUID()}-${input.fileName}`;
  const relPath = join(relDir, storedName).replaceAll("\\", "/");
  const absPath = join(absDir, storedName);
  await writeFile(absPath, input.bytes);

  return {
    fileName: input.fileName,
    storagePath: `local://${relPath}`,
    checksum
  };
}

export function resolveDownloadUrl(storagePath: string) {
  if (storagePath.startsWith("local://")) {
    return `/api/files/download?path=${encodeURIComponent(storagePath)}`;
  }
  return storagePath;
}

export async function readLocalStoredFile(storagePath: string) {
  if (!storagePath.startsWith("local://")) {
    throw new Error("Unsupported storage scheme");
  }

  const rel = safeRelativePath(storagePath.replace("local://", ""));
  const root = await getLocalStorageRoot();
  const abs = join(root, rel);
  const bytes = await readFile(abs);
  const name = rel.split("/").pop() || "file.bin";
  return { bytes, fileName: name };
}

export async function checkLocalStorageHealth() {
  try {
    const root = await getLocalStorageRoot();
    await mkdir(root, { recursive: true });
    await access(root, constants.W_OK);
    return { ok: true, provider: "local", message: "Local storage writable", path: root };
  } catch {
    return { ok: false, provider: "local", message: "Local storage is not writable" };
  }
}
