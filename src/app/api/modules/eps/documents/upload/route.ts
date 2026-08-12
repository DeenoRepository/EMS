import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";
import { prisma } from "@/lib/db/prisma";
import { uploadDocumentFile } from "@/lib/storage/s3";
import { logEvent } from "@/lib/telemetry/logger";
import { ShellEventBus } from "@/lib/shell/event-bus";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";

// SEC-05: Maximum file size limit (50 MB) and MIME-type whitelist
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "text/plain",
]);

/**
 * POST /api/modules/eps/documents/upload
 *
 * Загрузить документ для оборудования EPS с валидацией типа и размера.
 * Публикует доменное событие `eps.document.attached`.
 *
 * @requires Permission: eps.documents.manage
 * @returns {Promise<{ success: true, document, version, downloadUrl }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    const permissions = await getUserEpsPermissions();
    if (!permissions.canEdit) {
      logEvent({
        level: "warn",
        module: "EPS",
        action: "DOCUMENT_UPLOAD_DENIED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Загрузка документов доступна только редакторам и администраторам.",
        undefined,
        403,
        request
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const equipmentId = formData.get("equipmentId") as string | null;
    const docType = (formData.get("docType") as string) || "OTHER";
    const title = (formData.get("title") as string) || file?.name || "Новый документ";
    const notes = formData.get("notes") as string | null;

    if (!file || !equipmentId) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Файл и ID оборудования являются обязательными полями",
        undefined,
        400,
        request
      );
    }

    // SEC-05: Validate File Size
    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse(
        "FILE_TOO_LARGE",
        `Размер файла превышает максимально допустимый лимит (50 МБ). Текущий размер: ${(file.size / (1024 * 1024)).toFixed(2)} МБ`,
        { maxSize: MAX_FILE_SIZE, actualSize: file.size },
        400,
        request
      );
    }

    // SEC-05: Validate File MIME-Type
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return createErrorResponse(
        "UNSUPPORTED_MIME_TYPE",
        `Неподдерживаемый тип файла: ${file.type}. Разрешены: PDF, DWG/DOCX, XLSX, PNG/JPG, ZIP, TXT.`,
        { allowedTypes: Array.from(ALLOWED_MIME_TYPES) },
        400,
        request
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Загрузка в S3 / Local Storage с расчетом SHA-256
    const uploadResult = await uploadDocumentFile({
      fileName: file.name,
      buffer,
      contentType: file.type || "application/octet-stream",
      folder: `equipment/${equipmentId}`,
    });

    // Атомарное создание/поиск документа и добавление версии в одной транзакции
    const { document, newVersion } = await prisma.$transaction(async (tx) => {
      let doc = await tx.document.findFirst({
        where: { equipmentId, title },
      });

      if (!doc) {
        doc = await tx.document.create({
          data: {
            equipmentId,
            title,
            docType: docType as never,
            status: "DRAFT",
          },
        });
      }

      const versionCount = await tx.documentVersion.count({
        where: { documentId: doc.id },
      });

      const ver = await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: versionCount + 1,
          fileName: file.name,
          storagePath: uploadResult.storagePath,
          checksum: uploadResult.checksum,
          notes: notes || undefined,
          metadata: {
            fileSize: uploadResult.fileSize,
            mimeType: file.type,
            uploadedBy: session.username,
          },
          createdById: session.id,
        },
      });

      return { document: doc, newVersion: ver };
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "DOCUMENT_UPLOADED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        equipmentId,
        documentId: document.id,
        version: newVersion.versionNumber,
        fileSize: file.size,
      },
    });

    await ShellEventBus.publish(
      "eps.document.attached",
      "EPS",
      {
        documentId: document.id,
        equipmentId,
        title,
        version: newVersion.versionNumber,
        fileName: file.name,
        performedBy: session.id,
        performedByEmail: session.email,
      },
      correlationId
    );

    return createSuccessResponse(
      {
        success: true,
        document,
        version: newVersion,
        downloadUrl: uploadResult.url,
      },
      request,
      201
    );
  } catch (error) {
    console.error("Document upload error:", error);
    logEvent({
      level: "error",
      module: "EPS",
      action: "DOCUMENT_UPLOAD_FAILED",
      requestId: correlationId,
      error: String(error),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка при сохранении документа",
      undefined,
      500,
      request
    );
  }
}
