import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { resolveWmsScope } from "@/lib/wms/access-scope";
import { writeAudit } from "@/lib/audit/log";

function responseFromThrown(error: unknown) {
  if (error instanceof Response) {
    return new NextResponse(error.body, { status: error.status, headers: error.headers });
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ lineId: string }> }) {
  try {
    enforceSameOrigin(req);
    const rateLimited = enforceWriteRateLimit(req, { scope: "wms:internal-requests:resolve" });
    if (rateLimited) return rateLimited;

    const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
    const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
    if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
      return NextResponse.json(
        { error: "Обработка дефицита доступна только центральному складу или администратору." },
        { status: 403 }
      );
    }

    const { lineId } = await params;
    const body = (await req.json()) as { action: "TO_PROCUREMENT" | "ANALOG_SUGGESTED" | "REJECTED"; note?: string };
    if (!["TO_PROCUREMENT", "ANALOG_SUGGESTED", "REJECTED"].includes(body.action)) {
      return NextResponse.json({ error: "Некорректное действие." }, { status: 400 });
    }

    const line = await prisma.internalRequestLine.findUnique({ where: { id: lineId } });
    if (!line) return NextResponse.json({ error: "Строка не найдена." }, { status: 404 });

    const updated = await prisma.internalRequestLine.update({
      where: { id: lineId },
      data: { status: body.action, resolutionNote: body.note || null }
    });

    await writeAudit(prisma, {
      actorEmail: user.email,
      action: "UPDATE",
      entityType: "INTERNAL_REQUEST_LINE",
      entityId: lineId,
      afterState: updated
    });

    return NextResponse.json(updated);
  } catch (error) {
    return responseFromThrown(error) || NextResponse.json({ error: "Не удалось обновить строку дефицита." }, { status: 500 });
  }
}
