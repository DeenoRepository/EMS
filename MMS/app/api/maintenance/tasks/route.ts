import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { createPprTaskSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { parsePagination, parseSort } from "@/lib/pagination";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status");
  const maintenanceType = searchParams.get("maintenanceType");
  const pagination = parsePagination(searchParams, { pageSize: 20, maxPageSize: 200 });
  const sort = parseSort(searchParams, ["scheduledDate", "updatedAt", "createdAt"], "scheduledDate");

  const where = {
    ...(q ? { equipmentId: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status && status !== "all" ? { status: status as any } : {}),
    ...(maintenanceType && maintenanceType !== "all" ? { maintenanceType: maintenanceType as any } : {})
  };

  const [items, total] = await Promise.all([
    prisma.pprTask.findMany({
      where,
      orderBy: { [sort.sortBy]: sort.order },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.pprTask.count({ where })
  ]);

  return NextResponse.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "ppr-task:create" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = createPprTaskSchema.parse(await req.json());
  const scheduledDate = new Date(payload.scheduledDate);
  if (Number.isNaN(scheduledDate.getTime())) {
    return NextResponse.json({ error: "Некорректная плановая дата" }, { status: 400 });
  }

  const syncedEquipment = await prisma.syncedEquipment.findUnique({ where: { id: payload.equipmentId } });
  if (!syncedEquipment) {
    return NextResponse.json({ error: "Оборудование не найдено в локальном реестре ТОиР. Выполните синхронизацию из EPS." }, { status: 400 });
  }

  const created = await prisma.pprTask.create({
    data: {
      planId: payload.planId,
      equipmentId: payload.equipmentId,
      scheduledDate,
      maintenanceType: payload.maintenanceType,
      status: payload.status || (scheduledDate < new Date() ? "OVERDUE" : "PLANNED"),
      resultNotes: payload.resultNotes,
      laborHours: payload.laborHours,
      totalCost: payload.totalCost,
      spareParts: payload.spareParts,
      createdById: user.id,
      updatedById: user.id
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "PprTask",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json(created, { status: 201 });
}
