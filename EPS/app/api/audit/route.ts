import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { parsePagination } from "@/lib/pagination";
import { getDefaultPageSize } from "@/lib/settings/runtime";

export async function GET(req: NextRequest) {
  await requireAnyRole(["ADMIN"]);
  const { searchParams } = new URL(req.url);
  const defaultPageSize = await getDefaultPageSize();
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const actor = searchParams.get("actor");
  const action = searchParams.get("action");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const q = searchParams.get("q") || "";
  const pagination = parsePagination(searchParams, { pageSize: defaultPageSize, maxPageSize: 100 });

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(actor ? { actorEmail: { contains: actor, mode: "insensitive" as const } } : {}),
    ...(action && action !== "all" ? { action: action as any } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {})
          }
        }
      : {}),
    ...(q
      ? {
          OR: [
            { actorEmail: { contains: q, mode: "insensitive" as const } },
            { entityType: { contains: q, mode: "insensitive" as const } },
            { entityId: { contains: q, mode: "insensitive" as const } },
            { action: { equals: q.toUpperCase() as any } }
          ]
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.auditLog.count({ where })
  ]);

  return NextResponse.json({
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize
  });
}
