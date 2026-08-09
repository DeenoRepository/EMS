import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";
import { logEvent } from "@/lib/telemetry/logger";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const equipmentCode = searchParams.get("equipmentCode");

  try {
    const permissions = await getUserEpsPermissions();
    const where: Record<string, unknown> = {};
    if (equipmentCode) {
      where.equipment = { equipmentCode };
    }

    // SEC-03: Restricted document access by department for non-unrestricted (non-ADMIN) users
    if (!permissions.isUnrestricted && session.department) {
      where.equipment = {
        ...(where.equipment as object || {}),
        department: session.department
      };
    }

    const dbDocs = await prisma.document.findMany({
      where,
      include: { equipment: true, versions: true },
      orderBy: { updatedAt: "desc" }
    });

    const mapped = dbDocs.map((d) => ({
      id: d.id,
      equipmentId: d.equipmentId,
      equipmentCode: d.equipment.equipmentCode,
      title: d.title,
      docType: d.docType,
      status: d.status,
      fileName: d.versions[0]?.fileName || "document.pdf",
      fileSize: (d.versions[0]?.metadata as any)?.fileSize || "1.2 MB",
      version: d.versions[0]?.versionNumber || 1,
      updatedAt: d.updatedAt.toISOString()
    }));

    return NextResponse.json({ items: mapped, total: mapped.length });
  } catch (err) {
    console.error("EPS Documents DB query failed:", err);
    return NextResponse.json({ error: "Ошибка базы данных при получении документов" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const permissions = await getUserEpsPermissions();
    if (!permissions.canEdit) {
      return NextResponse.json({ error: "Отказано в доступе. Загрузка документов доступна только редакторам." }, { status: 403 });
    }

    const body = await request.json();
    if (!body.equipmentId || !body.title) {
      return NextResponse.json({ error: "Необходимые поля (equipmentId, title) не заполнены" }, { status: 400 });
    }

    const created = await prisma.document.create({
      data: {
        equipmentId: body.equipmentId,
        title: body.title,
        docType: body.docType || "OTHER",
        status: "IN_REVIEW"
      }
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "DOCUMENT_CREATED",
      userId: session.id,
      userEmail: session.email,
      details: { documentId: created.id, equipmentId: body.equipmentId }
    });

    return NextResponse.json({ success: true, item: created }, { status: 201 });
  } catch (err) {
    console.error("EPS Document POST failed:", err);
    return NextResponse.json({ error: "Ошибка загрузки документа в базу данных" }, { status: 500 });
  }
}
