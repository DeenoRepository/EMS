import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MOCK_DOCUMENTS, DocumentItem } from "@/lib/modules/eps-advanced-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const equipmentCode = searchParams.get("equipmentCode");

  try {
    const where: any = {};
    if (equipmentCode) {
      where.equipment = { equipmentCode };
    }

    const dbDocs = await prisma.document.findMany({
      where,
      include: { equipment: true, versions: true },
      orderBy: { updatedAt: "desc" }
    });

    if (dbDocs.length > 0) {
      const mapped = dbDocs.map((d) => ({
        id: d.id,
        equipmentId: d.equipmentId,
        equipmentCode: d.equipment.equipmentCode,
        title: d.title,
        docType: d.docType,
        status: d.status,
        fileName: d.versions[0]?.fileName || "document.pdf",
        fileSize: "1.2 MB",
        version: d.versions[0]?.versionNumber || 1,
        updatedAt: d.updatedAt.toISOString()
      }));
      return NextResponse.json({ items: mapped, total: mapped.length });
    }
  } catch (err) {
    console.warn("EPS Documents DB query failed, falling back to mock store:", err);
  }

  let items = MOCK_DOCUMENTS;
  if (equipmentCode) {
    items = items.filter((d) => d.equipmentCode === equipmentCode);
  }

  return NextResponse.json({ items, total: items.length });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawSize = body.bytesLength || 1024 * 500;
    const formattedSize =
      rawSize > 1024 * 1024
        ? `${(rawSize / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(rawSize / 1024)} KB`;

    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}`,
      equipmentId: body.equipmentId || "eq-001",
      equipmentCode: body.equipmentCode || "EQ-GENERAL",
      title: body.title || body.fileName || "Без названия",
      docType: body.docType || "OTHER",
      status: "IN_REVIEW",
      fileName: body.fileName || "document.pdf",
      fileSize: body.fileSize || formattedSize,
      version: 1,
      updatedAt: new Date().toISOString()
    };

    MOCK_DOCUMENTS.unshift(newDoc);
    return NextResponse.json({ success: true, item: newDoc }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки документа" }, { status: 400 });
  }
}


