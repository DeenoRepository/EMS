import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { movementIssueSchema } from "@/lib/validators/schemas";
import { prisma } from "@/lib/db/prisma";
import { stockService } from "@/lib/wms/stock-service";
import { Prisma } from "@prisma/client";
import { getWarehousePolicy } from "@/lib/wms/warehouse-policy";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:movements:issue" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = movementIssueSchema.parse(await req.json());
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (scope.access === "NONE") {
    return NextResponse.json({ error: "Склад не назначен пользователю." }, { status: 403 });
  }
  const policy = await getWarehousePolicy(prisma);
  const item = await prisma.stockItem.findUnique({ where: { id: payload.itemId } });
  if (!item) {
    return NextResponse.json({ error: "Позиция не найдена." }, { status: 404 });
  }
  if (!policy.primary) {
    return NextResponse.json({ error: "Не настроен основной склад." }, { status: 400 });
  }
  const resolvedWarehouseId =
    payload.warehouseId ||
    (scope.access === "CENTRAL"
      ? policy.primary.id
      : scope.access === "AUXILIARY"
        ? scope.responsibleWarehouseIds[0] || ""
        : "");

  if (!resolvedWarehouseId) {
    return NextResponse.json({ error: "Не удалось определить склад для выдачи по текущей роли." }, { status: 400 });
  }
  if (scope.access === "AUXILIARY" && !scope.responsibleWarehouseIds.includes(resolvedWarehouseId)) {
    return NextResponse.json({ error: "Можно выполнять выдачу только по своему складу." }, { status: 403 });
  }
  if (scope.access === "CENTRAL" && resolvedWarehouseId !== policy.primary.id) {
    return NextResponse.json({ error: "Ответственный центрального склада может выдавать только с центрального склада." }, { status: 403 });
  }
  if (item.supplyPolicy === "CENTRAL_ISSUE" && resolvedWarehouseId !== policy.primary.id) {
    return NextResponse.json({ error: "Для этой позиции выдача разрешена только с центрального склада." }, { status: 400 });
  }
  if (item.supplyPolicy === "DISTRIBUTED_CONSUMABLE" && resolvedWarehouseId === policy.primary.id) {
    return NextResponse.json({ error: "Для расходников выдача выполняется со вспомогательных складов." }, { status: 400 });
  }
  if (!payload.recipientType || !payload.recipientName || !payload.recipientName.trim()) {
    return NextResponse.json({ error: "Для выдачи укажите получателя: оборудование или сотрудник." }, { status: 400 });
  }
  const recipientComment =
    payload.recipientType && payload.recipientName
      ? `[${payload.recipientType === "EQUIPMENT" ? "Оборудование" : "Сотрудник"}: ${payload.recipientName.trim()}]`
      : "";
  const mergedComment = [recipientComment, payload.comment || ""].filter(Boolean).join(" ").trim() || undefined;

  try {
    const movement = await stockService.issue(
      { prisma, actor: user.email },
      {
        itemId: payload.itemId,
        warehouseId: resolvedWarehouseId,
        quantity: payload.quantity,
        relatedMmsWorkOrderId: payload.relatedMmsWorkOrderId,
        relatedMmsRequiredPartId: payload.relatedMmsRequiredPartId,
        comment: mergedComment,
        createdBy: payload.createdBy
      }
    );

    return NextResponse.json({ ...movement, quantity: Number(movement.quantity.toString()) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      const balances = await prisma.stockBalance.findMany({
        where: {
          itemId: payload.itemId,
          warehouseId: resolvedWarehouseId
        },
        select: { quantity: true, reservedQuantity: true }
      });
      const available = balances.reduce(
        (sum, row) => sum + Number((row.quantity as Prisma.Decimal).sub(row.reservedQuantity as Prisma.Decimal).toString()),
        0
      );

      return NextResponse.json(
        {
          error: `Недостаточно доступного остатка. Доступно: ${available}, запрошено: ${payload.quantity}.`,
          code: "INSUFFICIENT_STOCK",
          available_quantity: available,
          requested_quantity: payload.quantity
        },
        { status: 400 }
      );
    }
    throw error;
  }
}
