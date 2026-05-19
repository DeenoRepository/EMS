import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function GET(req: NextRequest) {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
    return NextResponse.json({ error: "Отчет доступен только центральному складу или администратору." }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") || 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.internalRequest.findMany({ where: { createdAt: { gte: since } }, include: { lines: true } });

  const total = rows.length;
  const fulfilled = rows.filter((r) => r.status === "FULFILLED").length;
  const partial = rows.filter((r) => r.status === "PARTIAL").length;
  const procurement = rows.filter((r) => r.status === "TO_PROCUREMENT").length;

  return NextResponse.json({
    days,
    total,
    fulfilled,
    partial,
    procurement,
    fulfillment_rate: total > 0 ? Math.round((fulfilled / total) * 1000) / 10 : 0
  });
}
