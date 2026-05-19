import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { movementTransferSchema } from "@/lib/validators/schemas";
import { prisma } from "@/lib/db/prisma";
import { stockService } from "@/lib/wms/stock-service";
import { getWarehousePolicy } from "@/lib/wms/warehouse-policy";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:movements:transfer" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (scope.access === "NONE") {
    return NextResponse.json({ error: "Склад не назначен пользователю." }, { status: 403 });
  }
  const payload = movementTransferSchema.parse(await req.json());
  const policy = await getWarehousePolicy(prisma);
  if (!policy.primary) {
    return NextResponse.json({ error: "Не настроен основной склад." }, { status: 400 });
  }
  if (scope.access === "CENTRAL") {
    if (payload.fromWarehouseId !== policy.primary.id) {
      return NextResponse.json({ error: "Ответственный центрального склада может перемещать только с центрального склада." }, { status: 403 });
    }
    if (payload.toWarehouseId === policy.primary.id) {
      return NextResponse.json({ error: "Назначение должно быть вспомогательным складом." }, { status: 400 });
    }
  }
  if (scope.access === "AUXILIARY") {
    if (!scope.responsibleWarehouseIds.includes(payload.fromWarehouseId)) {
      return NextResponse.json({ error: "Можно перемещать только со своего вспомогательного склада." }, { status: 403 });
    }
    if (payload.toWarehouseId === payload.fromWarehouseId) {
      return NextResponse.json({ error: "Склад-источник и склад-получатель не должны совпадать." }, { status: 400 });
    }
    const targetAux = await prisma.warehouse.findFirst({
      where: { id: payload.toWarehouseId, status: "ACTIVE", type: "AUXILIARY" },
      select: { id: true }
    });
    const isCentralTarget = payload.toWarehouseId === policy.primary.id;
    if (!isCentralTarget && !targetAux) {
      return NextResponse.json({ error: "Назначение перемещения: центральный или другой вспомогательный склад." }, { status: 400 });
    }
  }

  try {
    const movement = await stockService.transfer(
      { prisma, actor: user.email },
      {
        itemId: payload.itemId,
        fromWarehouseId: payload.fromWarehouseId,
        toWarehouseId: payload.toWarehouseId,
        quantity: payload.quantity,
        comment: payload.comment,
        createdBy: payload.createdBy
      }
    );

    return NextResponse.json({ ...movement, quantity: Number(movement.quantity.toString()) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "Insufficient available stock" }, { status: 400 });
    }
    throw error;
  }
}
