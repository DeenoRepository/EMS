import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { uploadDocumentFile } from "@/lib/storage/s3";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !hasRole(session, ["EDITOR", "APPROVER", "ADMIN"])) {
      return NextResponse.json(
        { error: "Доступ запрещен: недостаточно прав для загрузки документов" },
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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Загрузка в S3 / Local Storage с расчетом SHA-256
    const uploadResult = await uploadDocumentFile({
      fileName: file.name,
      buffer,
      contentType: file.type,
      folder: `equipment/${equipmentId}`
    });

    // Находим документ или создаем новый
    let document = await prisma.document.findFirst({
      where: { equipmentId, title }
    });

    if (!document) {
      document = await prisma.document.create({
        data: {
          equipmentId,
          title,
          docType: docType as any,
          status: "DRAFT"
        }
      });
    }

    // Получаем текущее количество версий
    const versionCount = await prisma.documentVersion.count({
      where: { documentId: document.id }
    });

    const newVersion = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
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
