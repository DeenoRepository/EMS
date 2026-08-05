import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join, normalize } from "path";

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

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "text/plain"
]);

const maxBytes = 20 * 1024 * 1024; // 20MB max
const defaultUploadsRoot = join(process.cwd(), "data", "uploads");

function safeRelativePath(value: string) {
  const normalized = normalize(value).replace(/^([/\\])+/, "");
  if (normalized.includes("..")) {
    throw new Error("Invalid storage path");
  }
  return normalized;
}

export async function storeLocalFile(input: StoreInput): Promise<StoredFile> {
  if (input.mimeType && !allowedMimeTypes.has(input.mimeType)) {
    throw new Error("Неподдерживаемый тип файла");
  }

  if (input.bytes.byteLength > maxBytes) {
    throw new Error(`Файл слишком большой. Максимум ${maxBytes / (1024 * 1024)}MB`);
  }

  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  const root = defaultUploadsRoot;

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const relDir = join(year, month);
  const absDir = join(root, relDir);
  
  await mkdir(absDir, { recursive: true });

  const storedName = `${randomUUID()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const relPath = join(relDir, storedName).replaceAll("\\", "/");
  const absPath = join(absDir, storedName);
  await writeFile(absPath, input.bytes);

  return {
    fileName: input.fileName,
    storagePath: `local://${relPath}`,
    checksum
  };
}

export async function readLocalStoredFile(storagePath: string) {
  if (!storagePath.startsWith("local://")) {
    throw new Error("Неподдерживаемый протокол хранилища");
  }

  const rel = safeRelativePath(storagePath.replace("local://", ""));
  const abs = join(defaultUploadsRoot, rel);
  const bytes = await readFile(abs);
  const name = rel.split("/").pop() || "file.bin";
  return { bytes, fileName: name };
}
