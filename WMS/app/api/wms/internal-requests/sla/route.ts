import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function GET(req: NextRequest) {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
    return NextResponse.json({ error: "SLA доступен только центральному складу или администратору." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const targetHours = Number(searchParams.get("targetHours") || "24");
  const rows = await prisma.internalRequest.findMany({
    include: { lines: true },
    orderBy: { createdAt: "desc" },
    take: 500
  });

  const now = Date.now();
  const enriched = rows.map((r) => {
    const ageHours = (now - new Date(r.createdAt).getTime()) / 3_600_000;
    const overdue = ageHours > targetHours && !["FULFILLED", "REJECTED"].includes(r.status);
    return { id: r.id, requestNumber: r.requestNumber, status: r.status, ageHours: Math.round(ageHours * 10) / 10, overdue };
  });

  return NextResponse.json({
    target_hours: targetHours,
    total: enriched.length,
    overdue: enriched.filter((r) => r.overdue).length,
    reserved: enriched.filter((r) => r.status === "RESERVED").length,
    fulfilled: enriched.filter((r) => r.status === "FULFILLED").length,
    items: enriched
  });
}
