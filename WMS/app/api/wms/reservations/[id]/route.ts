import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { id } = await params;

  const item = await prisma.stockReservation.findUnique({
    where: { id },
    include: {
      item: true,
      warehouse: true
    }
  });

  if (!item) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  return NextResponse.json({ ...item, quantity: Number(item.quantity.toString()) });
}
