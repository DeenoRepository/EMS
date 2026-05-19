import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceSameOrigin(req);
    const rateLimited = enforceWriteRateLimit(req, { scope: "wms:internal-requests:fulfill" });
    if (rateLimited) return rateLimited;
    const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
    const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
    if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
      return NextResponse.json({ error: "Исполнение заявок доступно только центральному складу или администратору." }, { status: 403 });
    }

    const { id } = await params;
    const requestEntity = await prisma.internalRequest.findUnique({ where: { id }, include: { lines: true } });
    if (!requestEntity) return NextResponse.json({ error: "Заявка не найдена." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      const reservedLines = requestEntity.lines.filter((l) => l.status === "RESERVED" && l.reservationId);
      if (reservedLines.length === 0) {
        throw new Error("NOTHING_TO_FULFILL");
      }
      for (const line of reservedLines) {
        const reservation = await tx.stockReservation.findUnique({ where: { id: line.reservationId! } });
        if (!reservation || reservation.status !== "ACTIVE") continue;

        const source = await tx.stockBalance.findFirst({ where: { itemId: line.itemId, warehouseId: requestEntity.toWarehouseId } });
        if (!source) throw new Error("INSUFFICIENT_STOCK");
        const target = await tx.stockBalance.findFirst({ where: { itemId: line.itemId, warehouseId: requestEntity.fromWarehouseId } });
        const qty = reservation.quantity;

        await tx.stockBalance.update({
          where: { id: source.id },
          data: {
            quantity: source.quantity.minus(qty),
            reservedQuantity: source.reservedQuantity.minus(qty)
          }
        });

        if (target) {
          await tx.stockBalance.update({ where: { id: target.id }, data: { quantity: target.quantity.plus(qty) } });
        } else {
          await tx.stockBalance.create({
            data: {
              itemId: line.itemId,
              warehouseId: requestEntity.fromWarehouseId,
              quantity: qty,
              reservedQuantity: new Prisma.Decimal(0)
            }
          });
        }

        await tx.stockReservation.update({ where: { id: reservation.id }, data: { status: "ISSUED" } });
        await tx.internalRequestLine.update({ where: { id: line.id }, data: { status: "ISSUED", issuedQty: qty, resolutionNote: "Выдано центральным складом" } });
        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            warehouseId: requestEntity.toWarehouseId,
            toWarehouseId: requestEntity.fromWarehouseId,
            movementType: "TRANSFER",
            quantity: qty,
            comment: `Internal request ${requestEntity.requestNumber}`,
            createdBy: user.email
          }
        });
      }
      await tx.internalRequest.update({ where: { id }, data: { status: "FULFILLED" } });
    });

    await writeAudit(prisma, {
      actorEmail: user.email,
      action: "UPDATE",
      entityType: "INTERNAL_REQUEST",
      entityId: id,
      metadata: { op: "fulfill" }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "NOTHING_TO_FULFILL") {
      return NextResponse.json({ error: "Для исполнения нет зарезервированных позиций. Сначала выполните резервирование." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "Недостаточно остатка для исполнения." }, { status: 400 });
    }
    return responseFromThrown(error) || NextResponse.json({ error: "Не удалось исполнить заявку." }, { status: 500 });
  }
}
