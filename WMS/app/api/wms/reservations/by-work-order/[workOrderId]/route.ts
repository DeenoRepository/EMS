import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ workOrderId: string }> }) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { workOrderId } = await params;

  const items = await prisma.stockReservation.findMany({
    where: { mmsWorkOrderId: workOrderId },
    orderBy: [{ createdAt: "desc" }],
    include: { item: true, warehouse: true }
  });

  return NextResponse.json({
    items: items.map((row) => ({ ...row, quantity: Number(row.quantity.toString()) }))
  });
}
