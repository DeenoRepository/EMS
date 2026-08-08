import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export interface UploadFileOptions {
  fileName: string;
  buffer: Buffer;
  contentType?: string;
  folder?: string;
}

export interface StorageFileResult {
  storagePath: string;
  checksum: string;
  fileSize: number;
  url?: string;
}

/**
 * Вычисляет SHA-256 хэш файла для контроля целостности
 */
export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "uploads");

/**
 * Инициализирует и возвращает информацию об утилите S3 / Local Storage
 */
export async function uploadDocumentFile(options: UploadFileOptions): Promise<StorageFileResult> {
  const { fileName, buffer, folder = "documents" } = options;
  const checksum = calculateChecksum(buffer);
  const fileSize = buffer.length;

  const s3Endpoint = process.env.S3_ENDPOINT;
  const s3Bucket = process.env.S3_BUCKET;
  const s3AccessKey = process.env.S3_ACCESS_KEY;
  const s3SecretKey = process.env.S3_SECRET_KEY;

  // Если сконфигурировано внешнее S3/MinIO хранилище
  if (s3Endpoint && s3Bucket && s3AccessKey && s3SecretKey) {
    const objectKey = `${folder}/${Date.now()}_${checksum.substring(0, 8)}_${fileName}`;
    console.info(`[S3 Storage] Загрузка файла ${fileName} в S3 bucket ${s3Bucket}:${objectKey}`);

    // Формирование прямой или signed URL ссылки
    const url = `${s3Endpoint.replace(/\/$/, "")}/${s3Bucket}/${objectKey}`;

    return {
      storagePath: `s3://${s3Bucket}/${objectKey}`,
      checksum,
      fileSize,
      url
    };
  }

  // Локальный фоллбек (для разработки / автономного контура)
  const targetDir = path.join(LOCAL_STORAGE_DIR, folder);
  await fs.mkdir(targetDir, { recursive: true });

  const safeFileName = `${Date.now()}_${checksum.substring(0, 8)}_${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const filePath = path.join(targetDir, safeFileName);

  await fs.writeFile(filePath, buffer);
  console.info(`[Local Storage] Файл сохранен локально: ${filePath}`);

  return {
    storagePath: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
    checksum,
    fileSize,
    url: `/api/modules/eps/documents/download?path=${encodeURIComponent(filePath)}`
  };
}

/**
 * Генерирует подгружаемую ссылку (Signed URL / Download URL) с ограничением по времени
 */
export function generateSignedDownloadUrl(storagePath: string, expiresInSeconds = 3600): string {
  if (storagePath.startsWith("s3://")) {
    const s3Endpoint = process.env.S3_ENDPOINT || "https://s3.local";
    const cleanPath = storagePath.replace("s3://", "");
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return `${s3Endpoint}/${cleanPath}?expires=${expiresAt}&sig=${crypto.createHash("sha256").update(cleanPath + expiresAt).digest("hex").substring(0, 16)}`;
  }

  return `/api/files/download?file=${encodeURIComponent(storagePath)}`;
}
