import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { parsePagination, parseSort } from "@/lib/pagination";
import { maybeAutoSyncEquipment } from "@/lib/integrations/equipment-sync";

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  await maybeAutoSyncEquipment();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status");
  const lifecycleStage = searchParams.get("lifecycleStage");
  const pagination = parsePagination(searchParams, { pageSize: 20, maxPageSize: 200 });
  const sort = parseSort(searchParams, ["name", "equipmentCode", "department", "updatedAt"], "name");

  const where = {
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" as const } },
            { equipmentCode: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { inventoryNumber: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(lifecycleStage && lifecycleStage !== "all" ? { lifecycleStage } : {})
  };

  const [items, total] = await Promise.all([
    prisma.syncedEquipment.findMany({
      where,
      orderBy: { [sort.sortBy]: sort.order },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.syncedEquipment.count({ where })
  ]);

  return NextResponse.json({
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize
  });
}
