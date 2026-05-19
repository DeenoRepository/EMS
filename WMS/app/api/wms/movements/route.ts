import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parsePagination, parseSort } from "@/lib/pagination";
import { requireAnyRole } from "@/lib/auth/rbac";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function GET(req: NextRequest) {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const itemId = searchParams.get("itemId") || "";
  const warehouseId = searchParams.get("warehouseId") || "";
  const movementType = searchParams.get("movementType") || "all";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const pagination = parsePagination(searchParams, { pageSize: 50, maxPageSize: 500 });
  const sort = parseSort(searchParams, ["createdAt"], "createdAt");

  const scopeFilter =
    scope.access === "ADMIN"
      ? {}
      : scope.access === "CENTRAL"
        ? { warehouseId: scope.centralWarehouseId || "__none__" }
        : scope.access === "AUXILIARY"
          ? { warehouseId: { in: scope.responsibleWarehouseIds } }
          : { warehouseId: "__none__" };

  const where = {
    ...(q
      ? {
          item: {
            OR: [
              { sku: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } }
            ]
          }
        }
      : {}),
    ...(itemId ? { itemId } : {}),
    ...(warehouseId ? { warehouseId } : {}),
    ...(movementType !== "all" ? { movementType: movementType as any } : {}),
    ...scopeFilter,
    ...((from || to)
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {})
          }
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: { item: true, warehouse: true, toWarehouse: true, reservation: true },
      orderBy: { [sort.sortBy]: sort.order },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.stockMovement.count({ where })
  ]);

  return NextResponse.json({
    items: items.map((row) => ({
      ...row,
      quantity: Number(row.quantity.toString())
    })),
    total,
    page: pagination.page,
    pageSize: pagination.pageSize
  });
}
