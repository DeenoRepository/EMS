import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parsePagination, parseSort } from "@/lib/pagination";
import { requireAnyRole } from "@/lib/auth/rbac";
import { createStockItemSchema } from "@/lib/validators/schemas";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status") || "all";
  const category = searchParams.get("category") || "";
  const pagination = parsePagination(searchParams, { pageSize: 20, maxPageSize: 200 });
  const sort = parseSort(searchParams, ["name", "sku", "createdAt", "updatedAt"], "updatedAt");

  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { sku: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(status !== "all" ? { status: status as any } : {}),
    ...(category ? { category } : {})
  };

  const [items, total] = await Promise.all([
    prisma.stockItem.findMany({
      where,
      orderBy: { [sort.sortBy]: sort.order },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.stockItem.count({ where })
  ]);

  return NextResponse.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:items:create" });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["EDITOR", "ADMIN"]);

  const payload = createStockItemSchema.parse(await req.json());

  const created = await prisma.stockItem.create({
    data: {
      sku: payload.sku,
      name: payload.name,
      description: payload.description,
      category: payload.category,
      unit: payload.unit,
      minQuantity: payload.minQuantity,
      status: payload.status,
      supplyPolicy: payload.supplyPolicy
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "StockItem",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json(created, { status: 201 });
}
