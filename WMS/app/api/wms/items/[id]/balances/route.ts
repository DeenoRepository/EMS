import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { id } = await params;

  const rows = await prisma.stockBalance.findMany({
    where: { itemId: id },
    include: {
      warehouse: true
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  const items = rows.map((row) => ({
    id: row.id,
    itemId: row.itemId,
    warehouseId: row.warehouseId,
    quantity: Number(row.quantity.toString()),
    reservedQuantity: Number(row.reservedQuantity.toString()),
    availableQuantity: Number(row.quantity.minus(row.reservedQuantity).toString()),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    warehouse: row.warehouse
  }));

  return NextResponse.json({ items });
}
