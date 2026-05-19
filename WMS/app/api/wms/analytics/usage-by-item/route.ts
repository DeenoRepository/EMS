import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function GET(req: NextRequest) {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
    return NextResponse.json({ error: "Аналитика доступна только центральному складу или администратору." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") || 30);
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * Math.max(1, days));

  const issueRows = await prisma.stockMovement.groupBy({
    by: ["itemId"],
    where: { movementType: "ISSUE", createdAt: { gte: since } },
    _sum: { quantity: true },
    _count: { _all: true }
  });

  const items = await prisma.stockItem.findMany({ where: { id: { in: issueRows.map((r) => r.itemId) } } });
  const byId = new Map(items.map((i) => [i.id, i]));
  const result = issueRows
    .map((row) => ({
      item_id: row.itemId,
      sku: byId.get(row.itemId)?.sku || "",
      name: byId.get(row.itemId)?.name || row.itemId,
      issue_count: row._count._all,
      issued_quantity: Number((row._sum.quantity || 0).toString())
    }))
    .sort((a, b) => b.issued_quantity - a.issued_quantity)
    .slice(0, 50);

  return NextResponse.json({ items: result });
}
