import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { createPprPlanSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { parsePagination, parseSort } from "@/lib/pagination";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status");
  const pagination = parsePagination(searchParams, { pageSize: 20, maxPageSize: 100 });
  const sort = parseSort(searchParams, ["nextServiceDate", "updatedAt", "createdAt"], "updatedAt");

  const where = {
    ...(q
      ? {
          OR: [
            { equipmentId: { contains: q, mode: "insensitive" as const } },
            { equipmentCode: { contains: q, mode: "insensitive" as const } },
            { equipmentName: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(status && status !== "all" ? { status: status as any } : {})
  };

  const [items, total] = await Promise.all([
    prisma.pprPlan.findMany({
      where,
      orderBy: { [sort.sortBy]: sort.order },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.pprPlan.count({ where })
  ]);

  return NextResponse.json({
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize
  });
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "ppr-plan:create" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = createPprPlanSchema.parse(await req.json());
  const lastServiceDate = new Date(payload.lastServiceDate);
  if (Number.isNaN(lastServiceDate.getTime())) {
    return NextResponse.json({ error: "Некорректная дата последнего ТО" }, { status: 400 });
  }

  const syncedEquipment = await prisma.syncedEquipment.findUnique({ where: { id: payload.equipmentId } });
  if (!syncedEquipment) {
    return NextResponse.json({ error: "Оборудование не найдено в локальном реестре ТОиР. Выполните синхронизацию из EPS." }, { status: 400 });
  }

  const nextServiceDate = new Date(lastServiceDate);
  nextServiceDate.setDate(nextServiceDate.getDate() + payload.intervalDays);

  const created = await prisma.pprPlan.create({
    data: {
      equipmentId: payload.equipmentId,
      equipmentCode: syncedEquipment.equipmentCode || payload.equipmentCode,
      equipmentName: syncedEquipment.name || payload.equipmentName,
      maintenanceType: payload.maintenanceType,
      intervalDays: payload.intervalDays,
      horizonMonths: payload.horizonMonths,
      lastServiceDate,
      nextServiceDate,
      comments: payload.comments,
      status: "ACTIVE",
      createdById: user.id,
      updatedById: user.id
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "PprPlan",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json(created, { status: 201 });
}
