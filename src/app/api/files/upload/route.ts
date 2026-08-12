import { storeSecureFile } from "@/lib/storage/secure-provider";
import { getSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";

export const runtime = "nodejs";

/**
 * POST /api/files/upload
 *
 * Загрузить файл в защищённое хранилище (Local или S3/MinIO).
 * Применяется валидация MIME-типа, размера и sanitization имени файла.
 *
 * @returns {Promise<{ success: true, file: StoredFile }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Файл не передан",
        undefined,
        400,
        request
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await storeSecureFile({
      fileName: file.name || "document.pdf",
      mimeType: file.type || "application/pdf",
      bytes,
    });

    logEvent({
      level: "audit",
      module: "STORAGE",
      action: "FILE_UPLOADED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        fileName: stored.fileName,
        storagePath: stored.storagePath,
        checksum: stored.checksum,
        size: bytes.length,
      },
    });

    return createSuccessResponse({ success: true, file: stored }, request, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка загрузки файла";
    logEvent({
      level: "error",
      module: "STORAGE",
      action: "FILE_UPLOAD_FAILED",
      requestId: correlationId,
      error: String(error),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      message,
      undefined,
      400,
      request
    );
  }
}
