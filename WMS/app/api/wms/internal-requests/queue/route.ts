import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { resolveWmsScope } from "@/lib/wms/access-scope";

function toNumber(value: { toString(): string }) {
  return Number(value.toString());
}

export async function GET() {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
    return NextResponse.json({ error: "Очередь доступна только центральному складу или администратору." }, { status: 403 });
  }
  if (!scope.centralWarehouseId) {
    return NextResponse.json({ items: [] });
  }

  const lines = await prisma.internalRequestLine.findMany({
    where: { status: { in: ["TO_PROCUREMENT", "ANALOG_SUGGESTED", "NEW"] } },
    include: { item: true, request: { include: { fromWarehouse: true } } },
    orderBy: { createdAt: "desc" },
    take: 500
  });

  const itemIds = Array.from(new Set(lines.map((l) => l.itemId)));
  const centralBalances = await prisma.stockBalance.findMany({
    where: { warehouseId: scope.centralWarehouseId, itemId: { in: itemIds } }
  });
  const availableByItem = new Map<string, number>();
  for (const row of centralBalances) {
    const available = toNumber(row.quantity) - toNumber(row.reservedQuantity);
    availableByItem.set(row.itemId, available);
  }

  const queue = lines.filter((line) => {
    const needed = Math.max(0, toNumber(line.requestedQty) - toNumber(line.reservedQty));
    const available = availableByItem.get(line.itemId) ?? 0;
    if (line.status === "TO_PROCUREMENT" || line.status === "ANALOG_SUGGESTED") {
      return needed > available;
    }
    if (line.status === "NEW") {
      return needed > available;
    }
    return false;
  });

  return NextResponse.json({
    items: queue.map((l) => ({
      id: l.id,
      request_id: l.requestId,
      request_number: l.request.requestNumber,
      from_warehouse: l.request.fromWarehouse.name,
      item_id: l.itemId,
      sku: l.item.sku,
      name: l.item.name,
      requested_qty: toNumber(l.requestedQty),
      reserved_qty: toNumber(l.reservedQty),
      central_available_qty: availableByItem.get(l.itemId) ?? 0,
      status: l.status,
      resolution_note: l.resolutionNote
    }))
  });
}
