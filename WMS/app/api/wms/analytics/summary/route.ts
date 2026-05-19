import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";

export async function GET() {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);

  const primaryWarehouse = await prisma.warehouse.findFirst({ where: { status: "ACTIVE", type: "PRIMARY" } });
  const [totalItems, activeItems, activeWarehouses, activeReservations, balances, movements30d] = await Promise.all([
    prisma.stockItem.count(),
    prisma.stockItem.count({ where: { status: "ACTIVE" } }),
    prisma.warehouse.count({ where: { status: "ACTIVE" } }),
    prisma.stockReservation.count({ where: { status: "ACTIVE" } }),
    prisma.stockBalance.findMany({
      where: primaryWarehouse ? { warehouseId: primaryWarehouse.id } : { id: "__none__" },
      include: { item: true }
    }),
    prisma.stockMovement.count({ where: { createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) } } })
  ]);

  const lowStockCount = balances.filter((b) => b.item.minQuantity !== null && b.quantity.minus(b.reservedQuantity).lessThan(b.item.minQuantity)).length;
  const reservedSum = balances.reduce((sum, b) => sum + Number(b.reservedQuantity.toString()), 0);
  const factualRows = balances.filter((b) => b.quantity.greaterThan(0) || b.reservedQuantity.greaterThan(0));
  const factualItemKeys = new Set(factualRows.map((b) => `${b.itemId}:${b.warehouseId}`));
  const totalAvailable = balances.reduce((sum, b) => sum + Number(b.quantity.minus(b.reservedQuantity).toString()), 0);

  return NextResponse.json({
    total_items: totalItems,
    active_items: activeItems,
    active_warehouses: activeWarehouses,
    factual_positions: factualItemKeys.size,
    factual_balance_rows: factualRows.length,
    total_available_quantity: totalAvailable,
    low_stock_items: lowStockCount,
    active_reservations: activeReservations,
    active_reserved_quantity: reservedSum,
    movements_period_count: movements30d
  });
}
