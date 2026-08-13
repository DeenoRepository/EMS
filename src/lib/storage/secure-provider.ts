import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { realpath } from "fs/promises";
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
 * Валидирует безопасный путь локального файла с проверкой Path Containment (SEC-07)
 *
 * Защита от:
 * - Path traversal (../../etc/passwd)
 * - Абсолютных путей (/etc/passwd)
 * - Символических ссылок
 * - UNC путей (\\server\share)
 */
export async function getSanitizedAbsolutePath(relativePath: string): Promise<string> {
  // Убираем префикс uploads/ если есть
  const normalizedRelative = relativePath.replace(/^uploads[/\\]/, "");

  // SEC-07: Проверка на абсолютные пути и UNC
  if (path.isAbsolute(normalizedRelative) || normalizedRelative.startsWith("\\\\")) {
    throw new Error("CRITICAL SECURITY ERROR: Absolute paths are not allowed (SEC-07)");
  }

  // SEC-07: Проверка на path traversal
  if (normalizedRelative.includes("..")) {
    throw new Error("CRITICAL SECURITY ERROR: Path traversal attempt detected (SEC-07)");
  }

  const resolved = path.resolve(ROOT_STORAGE_DIR, normalizedRelative);

  // SEC-07: Проверка что путь находится внутри ROOT_STORAGE_DIR
  const normalizedRoot = path.resolve(ROOT_STORAGE_DIR);
  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    throw new Error("CRITICAL SECURITY ERROR: Path outside storage root (SEC-07)");
  }

  // SEC-07: Проверка реального пути (защита от symlink attacks)
  try {
    const realResolved = await realpath(resolved);
    const realRoot = await realpath(normalizedRoot);
    if (!realResolved.startsWith(realRoot)) {
      throw new Error("CRITICAL SECURITY ERROR: Symlink points outside storage root (SEC-07)");
    }
    return realResolved;
  } catch (err) {
    // Если файл не существует, возвращаем resolved путь
    // (для операций записи файл ещё не создан)
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return resolved;
    }
    throw err;
  }
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

  // SEC-07: Валидация folder параметра
  if (folder.includes("..") || path.isAbsolute(folder)) {
    throw new Error("CRITICAL SECURITY ERROR: Invalid folder parameter (SEC-07)");
  }

  const targetFolder = path.resolve(ROOT_STORAGE_DIR, folder);
  const normalizedRoot = path.resolve(ROOT_STORAGE_DIR);

  if (!targetFolder.startsWith(normalizedRoot)) {
    throw new Error("SECURITY ERROR: Target folder outside root storage (SEC-07)");
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
 * Чтение локального файла с гарантированной проверкой выхода за границы каталога (SEC-07)
 */
export async function readSecureFile(
  relativePath: string
): Promise<{ bytes: Buffer; fileName: string }> {
  const safeAbsolutePath = await getSanitizedAbsolutePath(relativePath);
  const bytes = await fs.readFile(safeAbsolutePath);
  const fileName = path.basename(safeAbsolutePath);

  return { bytes, fileName };
}
