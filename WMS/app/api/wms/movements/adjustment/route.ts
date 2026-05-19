import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { movementAdjustmentSchema } from "@/lib/validators/schemas";
import { prisma } from "@/lib/db/prisma";
import { stockService } from "@/lib/wms/stock-service";
import { resolveWmsScope } from "@/lib/wms/access-scope";
import { getWarehousePolicy } from "@/lib/wms/warehouse-policy";

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:movements:adjustment" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = movementAdjustmentSchema.parse(await req.json());
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  const policy = await getWarehousePolicy(prisma);
  if (scope.access === "NONE") return NextResponse.json({ error: "Склад не назначен пользователю." }, { status: 403 });
  if (scope.access === "AUXILIARY" && !scope.responsibleWarehouseIds.includes(payload.warehouseId)) {
    return NextResponse.json({ error: "Корректировка доступна только по своему складу." }, { status: 403 });
  }
  if (scope.access === "CENTRAL" && payload.warehouseId !== policy.primary?.id) {
    return NextResponse.json({ error: "Ответственный центрального склада может корректировать только центральный склад." }, { status: 403 });
  }

  try {
    const movement = await stockService.adjustment(
      { prisma, actor: user.email },
      {
        itemId: payload.itemId,
        warehouseId: payload.warehouseId,
        quantityDelta: payload.quantityDelta,
        comment: payload.comment,
        createdBy: payload.createdBy
      }
    );

    return NextResponse.json({ ...movement, quantity: Number(movement.quantity.toString()) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === "NEGATIVE_STOCK_FORBIDDEN" || error.message === "RESERVED_EXCEEDS_QUANTITY")) {
      return NextResponse.json({ error: "Invalid adjustment for current stock state" }, { status: 400 });
    }
    throw error;
  }
}
