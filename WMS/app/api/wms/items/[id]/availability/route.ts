import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { id } = await params;

  const rows = await prisma.stockBalance.findMany({
    where: { itemId: id },
    orderBy: [{ updatedAt: "desc" }]
  });

  const balances = rows.map((row) => {
    const available = row.quantity.minus(row.reservedQuantity);
    return {
      warehouse_id: row.warehouseId,
      quantity: Number(row.quantity.toString()),
      reserved_quantity: Number(row.reservedQuantity.toString()),
      available_quantity: Number(available.toString())
    };
  });

  const totalQuantity = balances.reduce((sum, row) => sum + row.quantity, 0);
  const reservedQuantity = balances.reduce((sum, row) => sum + row.reserved_quantity, 0);
  const availableQuantity = balances.reduce((sum, row) => sum + row.available_quantity, 0);

  return NextResponse.json({
    item_id: id,
    total_quantity: totalQuantity,
    reserved_quantity: reservedQuantity,
    available_quantity: availableQuantity,
    balances
  });
}
