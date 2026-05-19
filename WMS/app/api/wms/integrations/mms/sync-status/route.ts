import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [issuedLast24h, activeReservations, pendingInternal, movementsLast24h] = await Promise.all([
    prisma.stockReservation.count({ where: { status: "ISSUED", updatedAt: { gte: since } } }),
    prisma.stockReservation.count({ where: { status: "ACTIVE" } }),
    prisma.internalRequestLine.count({ where: { status: { in: ["TO_PROCUREMENT", "ANALOG_SUGGESTED"] } } }),
    prisma.stockMovement.count({ where: { createdAt: { gte: since } } })
  ]);

  return NextResponse.json({
    window_hours: 24,
    issued_last_24h: issuedLast24h,
    active_reservations: activeReservations,
    pending_procurement_or_analog: pendingInternal,
    movements_last_24h: movementsLast24h
  });
}
