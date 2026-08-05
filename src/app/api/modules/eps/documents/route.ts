import { NextResponse } from "next/server";
import { MOCK_DOCUMENTS, DocumentItem } from "@/lib/modules/eps-advanced-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const equipmentCode = searchParams.get("equipmentCode");

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

