import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parsePagination, parseSort } from "@/lib/pagination";
import { requireAnyRole } from "@/lib/auth/rbac";
import { createWarehouseSchema } from "@/lib/validators/schemas";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { resolveWmsScope } from "@/lib/wms/access-scope";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status") || "all";
  const pagination = parsePagination(searchParams, { pageSize: 20, maxPageSize: 200 });
  const sort = parseSort(searchParams, ["name", "code", "createdAt", "updatedAt"], "updatedAt");

  const where = {
    AND: [
      ...(q
        ? [{
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { code: { contains: q, mode: "insensitive" as const } }
            ]
          }]
        : []),
      ...(status !== "all" ? [{ status: status as any }] : []),
      ...(scope.access === "ADMIN"
        ? []
        : [{
            OR: [
              ...(scope.centralWarehouseId ? [{ id: scope.centralWarehouseId }] : []),
              ...(scope.responsibleWarehouseIds.length ? [{ id: { in: scope.responsibleWarehouseIds } }] : [])
            ]
          }])
    ]
  };

  const [items, total] = await Promise.all([
    prisma.warehouse.findMany({
      where,
      orderBy: { [sort.sortBy]: sort.order },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.warehouse.count({ where })
  ]);

  return NextResponse.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:warehouses:create" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = createWarehouseSchema.parse(await req.json());
  const created = await prisma.$transaction(async (tx) => {
    if (payload.type === "PRIMARY") {
      await tx.warehouse.updateMany({
        where: { type: "PRIMARY" },
        data: { type: "AUXILIARY" }
      });
    }
    return tx.warehouse.create({
      data: {
        name: payload.name,
        code: payload.code,
        description: payload.description,
        responsibleEmail: payload.responsibleEmail || null,
        status: payload.status,
        type: payload.type
      }
    });
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "Warehouse",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json(created, { status: 201 });
}
