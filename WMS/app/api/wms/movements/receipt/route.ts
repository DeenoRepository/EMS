import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { movementReceiptSchema } from "@/lib/validators/schemas";
import { prisma } from "@/lib/db/prisma";
import { stockService } from "@/lib/wms/stock-service";
import { getWarehousePolicy } from "@/lib/wms/warehouse-policy";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:movements:receipt" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
    return NextResponse.json({ error: "Поступление доступно только центральному складу или администратору." }, { status: 403 });
  }
  const payload = movementReceiptSchema.parse(await req.json());
  const policy = await getWarehousePolicy(prisma);
  if (!policy.primary) {
    return NextResponse.json({ error: "Не настроен основной склад." }, { status: 400 });
  }
  if (payload.warehouseId !== policy.primary.id) {
    return NextResponse.json({ error: "Поступление допускается только на основной склад." }, { status: 400 });
  }

  try {
    const movement = await stockService.receipt(
      { prisma, actor: user.email },
      {
        itemId: payload.itemId,
        warehouseId: payload.warehouseId,
        quantity: payload.quantity,
        comment: payload.comment,
        createdBy: payload.createdBy
      }
    );

    return NextResponse.json({ ...movement, quantity: Number(movement.quantity.toString()) }, { status: 201 });
  } catch (error) {
    throw error;
  }
}
