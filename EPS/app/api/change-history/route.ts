import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { parsePagination } from "@/lib/pagination";
import { getDefaultPageSize } from "@/lib/settings/runtime";

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const defaultPageSize = await getDefaultPageSize();
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category");
  const equipmentId = searchParams.get("equipmentId");
  const pagination = parsePagination(searchParams, { pageSize: defaultPageSize, maxPageSize: 100 });

  const categoryPredicates =
    category && category !== "all"
      ? category === "maintenance"
        ? [{ title: { contains: "maintenance", mode: "insensitive" as const } }]
        : category === "approval"
          ? [{ title: { contains: "approval", mode: "insensitive" as const } }]
          : category === "administrative"
            ? [{ title: { contains: "document", mode: "insensitive" as const } }]
            : [{ eventType: { in: ["UPDATED", "STATUS_CHANGED"] as any } }]
      : [];

  const where = {
    ...(equipmentId ? { equipmentId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { equipment: { name: { contains: q, mode: "insensitive" as const } } },
            { equipment: { equipmentCode: { contains: q, mode: "insensitive" as const } } }
          ]
        }
      : {}),
    ...(categoryPredicates.length ? { AND: [{ OR: categoryPredicates }] } : {})
  };

  const [items, total] = await Promise.all([
    prisma.equipmentEvent.findMany({
      where,
      include: {
        equipment: { select: { id: true, equipmentCode: true, name: true } },
        actor: { select: { displayName: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.equipmentEvent.count({ where })
  ]);

  return NextResponse.json({
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize
  });
}
