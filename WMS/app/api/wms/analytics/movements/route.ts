import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { resolveWmsScope } from "@/lib/wms/access-scope";

function keyByDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
    return NextResponse.json({ error: "Аналитика доступна только центральному складу или администратору." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") || 30);
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * Math.max(1, days));
  const rows = await prisma.stockMovement.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, movementType: true, quantity: true },
    orderBy: [{ createdAt: "asc" }]
  });

  const map = new Map<string, { date: string; total: number; receipt: number; issue: number; transfer: number; adjustment: number; reservation: number; reservation_cancel: number }>();
  for (const row of rows) {
    const date = keyByDay(row.createdAt);
    if (!map.has(date)) {
      map.set(date, { date, total: 0, receipt: 0, issue: 0, transfer: 0, adjustment: 0, reservation: 0, reservation_cancel: 0 });
    }
    const bucket = map.get(date)!;
    const q = Number(row.quantity.toString());
    bucket.total += q;
    const t = row.movementType.toLowerCase() as keyof typeof bucket;
    if (typeof bucket[t] === "number") bucket[t] += q;
  }

  return NextResponse.json({ items: [...map.values()] });
}
