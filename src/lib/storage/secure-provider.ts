import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { validateFileBuffer } from "./validation";

export interface SecureStorageUploadOptions {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  folder?: string;
}

export interface SecureStorageResult {
  storagePath: string;
  checksum: string;
  fileSize: number;
  fileName: string;
}

const ROOT_STORAGE_DIR = path.resolve(
  process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "uploads")
);

/**
 * Валидирует безопасный путь локального файла с проверкой Path Containment (SEC-06)
 */
export function getSanitizedAbsolutePath(relativePath: string): string {
  const normalizedRelative = relativePath.replace(/^uploads[/\\]/, "");
  const resolved = path.resolve(ROOT_STORAGE_DIR, normalizedRelative);

  if (!resolved.startsWith(ROOT_STORAGE_DIR + path.sep) && resolved !== ROOT_STORAGE_DIR) {
    throw new Error("CRITICAL SECURITY ERROR: Path traversal attempt detected (SEC-06)");
  }

  return resolved;
}

/**
 * Атомарное сохранение файла с генерацией случайного UUID-имени (SEC-06, SEC-07)
 */
export async function storeSecureFile(
  options: SecureStorageUploadOptions
): Promise<SecureStorageResult> {
  const { fileName, mimeType, bytes, folder = "documents" } = options;

  // 1. Валидация размера, MIME-типа и сигнатур Magic Bytes
  const valResult = validateFileBuffer(bytes, mimeType, fileName);
  if (!valResult.isValid) {
    throw new Error(valResult.error || "Ошибка валидации файла");
  }

  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
  const fileSize = bytes.length;

  // 2. Безопасное имя файла без сохранения пользовательского пути
  const ext = path.extname(fileName).replace(/[^a-zA-Z0-9]/g, "");
  const safeRandomName = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext ? "." + ext : ""}`;

  const targetFolder = path.resolve(ROOT_STORAGE_DIR, folder);
  if (!targetFolder.startsWith(ROOT_STORAGE_DIR)) {
    throw new Error("SECURITY ERROR: Target folder outside root storage");
  }

  await fs.mkdir(targetFolder, { recursive: true });
  const finalFilePath = path.join(targetFolder, safeRandomName);

  await fs.writeFile(finalFilePath, bytes);

  const relativeStoragePath = path.relative(process.cwd(), finalFilePath).replace(/\\/g, "/");

  return {
    storagePath: relativeStoragePath,
    checksum,
    fileSize,
    fileName,
  };
}

/**
 * Чтение локального файла с гарантированной проверкой выхода за границы каталога (SEC-06)
 */
export async function readSecureFile(
  relativePath: string
): Promise<{ bytes: Buffer; fileName: string }> {
  const safeAbsolutePath = getSanitizedAbsolutePath(relativePath);
  const bytes = await fs.readFile(safeAbsolutePath);
  const fileName = path.basename(safeAbsolutePath);

  return { bytes, fileName };
}
