import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function GET() {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
    return NextResponse.json({ error: "Отчет доступен только центральному складу или администратору." }, { status: 403 });
  }

  const [items, movements] = await Promise.all([
    prisma.stockItem.findMany({ where: { status: "ACTIVE" } }),
    prisma.stockMovement.findMany({ where: { movementType: "ISSUE" }, select: { itemId: true, quantity: true }, take: 5000 })
  ]);

  const byId = new Map(items.map((i) => [i.id, i]));
  let centralIssued = 0;
  let consumableIssued = 0;
  for (const mv of movements) {
    const item = byId.get(mv.itemId);
    if (!item) continue;
    if (item.supplyPolicy === "CENTRAL_ISSUE") centralIssued += Number(mv.quantity.toString());
    else consumableIssued += Number(mv.quantity.toString());
  }

  return NextResponse.json({
    active_items_total: items.length,
    central_issue_items: items.filter((i) => i.supplyPolicy === "CENTRAL_ISSUE").length,
    distributed_consumables_items: items.filter((i) => i.supplyPolicy === "DISTRIBUTED_CONSUMABLE").length,
    issued_quantity_central_policy: centralIssued,
    issued_quantity_consumables: consumableIssued
  });
}
