import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { stockService } from "@/lib/wms/stock-service";
import { resolveWmsScope } from "@/lib/wms/access-scope";
import { writeAudit } from "@/lib/audit/log";

function responseFromThrown(error: unknown) {
  if (error instanceof Response) {
    return new NextResponse(error.body, { status: error.status, headers: error.headers });
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(req);
    const rateLimited = enforceWriteRateLimit(req, { scope: "wms:internal-requests:reserve" });
    if (rateLimited) return rateLimited;
    const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
    const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
    if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
      return NextResponse.json({ error: "Резервирование заявок доступно только центральному складу или администратору." }, { status: 403 });
    }

    const { id } = await params;
    const requestEntity = await prisma.internalRequest.findUnique({ where: { id }, include: { lines: true } });
    if (!requestEntity) return NextResponse.json({ error: "Заявка не найдена." }, { status: 404 });

    for (const line of requestEntity.lines) {
      const missing = Number(line.requestedQty.toString()) - Number(line.reservedQty.toString());
      if (missing <= 0) continue;
      try {
        const reserved = await stockService.reserve(
          { prisma, actor: user.email },
          {
            itemId: line.itemId,
            warehouseId: requestEntity.toWarehouseId,
            quantity: missing,
            mmsWorkOrderId: requestEntity.requestNumber,
            mmsRequiredPartId: line.id
          }
        );
        await prisma.internalRequestLine.update({
          where: { id: line.id },
          data: {
            status: "RESERVED",
            reservedQty: new Prisma.Decimal(reserved.quantity),
            reservationId: reserved.reservationId,
            resolutionNote: null
          }
        });
      } catch {
        await prisma.internalRequestLine.update({
          where: { id: line.id },
          data: { status: "TO_PROCUREMENT", resolutionNote: "Нет остатка на центральном складе" }
        });
      }
    }

    const lines = await prisma.internalRequestLine.findMany({ where: { requestId: id } });
    const hasReserved = lines.some((l) => l.status === "RESERVED");
    const hasOther = lines.some((l) => l.status !== "RESERVED" && l.status !== "ISSUED");
    const status = hasReserved ? (hasOther ? "PARTIAL" : "RESERVED") : "TO_PROCUREMENT";
    const updated = await prisma.internalRequest.update({ where: { id }, data: { status: status as any } });
    await writeAudit(prisma, {
      actorEmail: user.email,
      action: "UPDATE",
      entityType: "INTERNAL_REQUEST",
      entityId: id,
      afterState: updated,
      metadata: { op: "reserve" }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return responseFromThrown(error) || NextResponse.json({ error: "Не удалось выполнить резервирование." }, { status: 500 });
  }
}
