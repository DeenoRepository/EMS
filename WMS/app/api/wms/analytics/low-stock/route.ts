import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";

export async function GET() {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);

  const primaryWarehouse = await prisma.warehouse.findFirst({ where: { status: "ACTIVE", type: "PRIMARY" } });
  if (!primaryWarehouse) return NextResponse.json({ items: [] });

  const [rows, itemsWithMin] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { warehouseId: primaryWarehouse.id },
      include: { item: true, warehouse: true },
      orderBy: [{ updatedAt: "desc" }]
    }),
    prisma.stockItem.findMany({ where: { status: "ACTIVE", minQuantity: { not: null } } })
  ]);

  const factualRows = rows.filter((row) => row.quantity.greaterThan(0) || row.reservedQuantity.greaterThan(0));
  const grouped = new Map<string, { item_id: string; sku: string; name: string; warehouse_id: string; warehouse_name: string; available_quantity: number; min_quantity: number | null }>();

  for (const row of factualRows) {
    const key = `${row.itemId}:${row.warehouseId}`;
    const available = Number(row.quantity.minus(row.reservedQuantity).toString());
    const min = row.item.minQuantity !== null ? Number(row.item.minQuantity.toString()) : null;
    const prev = grouped.get(key);
    if (!prev) {
      grouped.set(key, {
        item_id: row.itemId,
        sku: row.item.sku,
        name: row.item.name,
        warehouse_id: row.warehouseId,
        warehouse_name: row.warehouse.name,
        available_quantity: available,
        min_quantity: min
      });
    } else {
      grouped.set(key, { ...prev, available_quantity: prev.available_quantity + available });
    }
  }

  const factualKeys = new Set(factualRows.map((row) => `${row.itemId}:${row.warehouseId}`));
  for (const item of itemsWithMin) {
    const min = item.minQuantity ? Number(item.minQuantity.toString()) : null;
    if (min === null || min <= 0) continue;
    const key = `${item.id}:${primaryWarehouse.id}`;
    if (factualKeys.has(key) || grouped.has(key)) continue;
    grouped.set(key, {
      item_id: item.id,
      sku: item.sku,
      name: item.name,
      warehouse_id: primaryWarehouse.id,
      warehouse_name: primaryWarehouse.name,
      available_quantity: 0,
      min_quantity: min
    });
  }

  const items = Array.from(grouped.values())
    .filter((row) => row.min_quantity !== null && row.available_quantity < row.min_quantity)
    .map((row) => ({ ...row, is_low_stock: true }));

  return NextResponse.json({ items });
}
