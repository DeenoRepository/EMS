import path from "path";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 МБ

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
];

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  detectedMime?: string;
}

/**
 * Проверяет сигнатуру (Magic Bytes) файла в первичном буфере
 */
export function validateFileBuffer(
  buffer: Buffer,
  declaredMimeType: string,
  fileName: string
): FileValidationResult {
  // 1. Проверка размера файла
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: "Файл пуст или поврежден" };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `Превышен максимальный размер файла (Лимит: 10 МБ, получено: ${(buffer.length / (1024 * 1024)).toFixed(2)} МБ)`,
    };
  }

  // 2. Проверка расширения и заявленного MIME-типа
  const ext = path.extname(fileName).toLowerCase();
  const normalizedMime = (declaredMimeType || "").toLowerCase().trim();

  if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    return {
      isValid: false,
      error: `Тип файла "${declaredMimeType}" не входит в список разрешенных (PDF, PNG, JPEG, WEBP, DOCX, XLSX)`,
    };
  }

  // 3. Валидация сигнатур Magic Bytes
  if (normalizedMime === "application/pdf" || ext === ".pdf") {
    // PDF Magic Bytes: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
    if (buffer.length < 5 || buffer.toString("ascii", 0, 5) !== "%PDF-") {
      return {
        isValid: false,
        error: "Недействительная сигнатура файла PDF (ошибка magic bytes)",
      };
    }
  } else if (normalizedMime === "image/png" || ext === ".png") {
    // PNG Magic Bytes: \x89PNG\r\n\x1a\n (0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A)
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(pngMagic)) {
      return {
        isValid: false,
        error: "Недействительная сигнатура файла PNG (ошибка magic bytes)",
      };
    }
  } else if (
    normalizedMime === "image/jpeg" ||
    ext === ".jpg" ||
    ext === ".jpeg"
  ) {
    // JPEG Magic Bytes: \xFF\xD8\xFF
    if (
      buffer.length < 3 ||
      buffer[0] !== 0xff ||
      buffer[1] !== 0xd8 ||
      buffer[2] !== 0xff
    ) {
      return {
        isValid: false,
        error: "Недействительная сигнатура файла JPEG (ошибка magic bytes)",
      };
    }
  } else if (normalizedMime === "image/webp" || ext === ".webp") {
    // WEBP Magic Bytes: RIFF....WEBP
    if (
      buffer.length < 12 ||
      buffer.toString("ascii", 0, 4) !== "RIFF" ||
      buffer.toString("ascii", 8, 12) !== "WEBP"
    ) {
      return {
        isValid: false,
        error: "Недействительная сигнатура файла WEBP (ошибка magic bytes)",
      };
    }
  } else if (
    normalizedMime.includes("openxmlformats") ||
    ext === ".docx" ||
    ext === ".xlsx"
  ) {
    // Office OpenXML Magic Bytes: PK\x03\x04 (ZIP заголовок: 0x50, 0x4B, 0x03, 0x04)
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x50 ||
      buffer[1] !== 0x4b ||
      buffer[2] !== 0x03 ||
      buffer[3] !== 0x04
    ) {
      return {
        isValid: false,
        error: "Недействительная сигнатура документа Office/ZIP (ошибка magic bytes)",
      };
    }
  }

  return { isValid: true };
}
