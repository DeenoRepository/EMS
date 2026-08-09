import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";
import { prisma } from "@/lib/db/prisma";
import { uploadDocumentFile } from "@/lib/storage/s3";
import { logEvent } from "@/lib/telemetry/logger";

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
  "text/plain"
]);

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const permissions = await getUserEpsPermissions();
    if (!permissions.canEdit) {
      return NextResponse.json(
        { error: "Отказано в доступе. Загрузка документов доступна только редакторам и администраторам." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const equipmentId = formData.get("equipmentId") as string | null;
    const docType = (formData.get("docType") as string) || "OTHER";
    const title = (formData.get("title") as string) || file?.name || "Новый документ";
    const notes = formData.get("notes") as string | null;

    if (!file || !equipmentId) {
      return NextResponse.json(
        { error: "Файл и ID оборудования являются обязательными полями" },
        { status: 400 }
      );
    }

    // SEC-05: Validate File Size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Размер файла превышает максимально допустимый лимит (50 МБ). Текущий размер: ${(file.size / (1024 * 1024)).toFixed(2)} МБ` },
        { status: 400 }
      );
    }

    // SEC-05: Validate File MIME-Type
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Неподдерживаемый тип файла: ${file.type}. Разрешены: PDF, DWG/DOCX, XLSX, PNG/JPG, ZIP, TXT.` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Загрузка в S3 / Local Storage с расчетом SHA-256
    const uploadResult = await uploadDocumentFile({
      fileName: file.name,
      buffer,
      contentType: file.type || "application/octet-stream",
      folder: `equipment/${equipmentId}`
    });

    // Атомарное создание/поиск документа и добавление версии в одной транзакции
    const { document, newVersion } = await prisma.$transaction(async (tx) => {
      let doc = await tx.document.findFirst({
        where: { equipmentId, title }
      });

      if (!doc) {
        doc = await tx.document.create({
          data: {
            equipmentId,
            title,
            docType: docType as any,
            status: "DRAFT"
          }
        });
      }

      const versionCount = await tx.documentVersion.count({
        where: { documentId: doc.id }
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
            uploadedBy: session.username
          },
          createdById: session.id
        }
      });

      return { document: doc, newVersion: ver };
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "DOCUMENT_UPLOADED",
      userId: session.id,
      userEmail: session.email,
      details: { equipmentId, documentId: document.id, version: newVersion.versionNumber, fileSize: file.size }
    });

    return NextResponse.json({
      success: true,
      document,
      version: newVersion,
      downloadUrl: uploadResult.url
    });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { error: "Ошибка при сохранении документа" },
      { status: 500 }
    );
  }
}
