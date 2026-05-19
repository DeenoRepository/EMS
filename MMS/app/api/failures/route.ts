import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { parsePagination, parseSort } from "@/lib/pagination";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { failureCreateSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";

function parseDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const severity = searchParams.get("severity");
  const rcaStatus = searchParams.get("rcaStatus");
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  const pagination = parsePagination(searchParams, { pageSize: 20, maxPageSize: 200 });
  const sort = parseSort(searchParams, ["occurredAt", "downtimeMinutes", "updatedAt", "createdAt"], "occurredAt");

  const where = {
    ...(q
      ? {
          OR: [
            { equipmentId: { contains: q, mode: "insensitive" as const } },
            { equipmentCode: { contains: q, mode: "insensitive" as const } },
            { equipmentName: { contains: q, mode: "insensitive" as const } },
            { symptom: { contains: q, mode: "insensitive" as const } },
            { rootCauseCategory: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(severity && severity !== "all" ? { severity: severity as any } : {}),
    ...(rcaStatus && rcaStatus !== "all" ? { rcaStatus: rcaStatus as any } : {}),
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {})
          }
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.failureEvent.findMany({
      where,
      orderBy: { [sort.sortBy]: sort.order },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.failureEvent.count({ where })
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
  const rateLimited = enforceWriteRateLimit(req, { scope: "failures:create" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = failureCreateSchema.parse(await req.json());
  const occurredAt = parseDate(payload.occurredAt);
  if (!occurredAt) {
    return NextResponse.json({ error: "Некорректная дата отказа" }, { status: 400 });
  }

  const resolvedAt = parseDate(payload.resolvedAt);
  const dueDate = parseDate(payload.dueDate);
  const closedAt = parseDate(payload.closedAt);

  const syncedEquipment = await prisma.syncedEquipment.findUnique({ where: { id: payload.equipmentId } });
  if (!syncedEquipment) {
    return NextResponse.json(
      { error: "Оборудование не найдено в локальном реестре ТОиР. Выполните синхронизацию из EPS." },
      { status: 400 }
    );
  }

  const created = await prisma.failureEvent.create({
    data: {
      equipmentId: payload.equipmentId,
      equipmentCode: syncedEquipment.equipmentCode || payload.equipmentCode,
      equipmentName: syncedEquipment.name || payload.equipmentName,
      occurredAt,
      resolvedAt,
      downtimeMinutes: payload.downtimeMinutes || 0,
      failureNode: payload.failureNode,
      symptom: payload.symptom,
      rootCauseCategory: payload.rootCauseCategory,
      rootCauseDetail: payload.rootCauseDetail,
      severity: payload.severity || "MEDIUM",
      rcaStatus: payload.rcaStatus || "OPEN",
      correctiveAction: payload.correctiveAction,
      preventiveAction: payload.preventiveAction,
      owner: payload.owner,
      dueDate,
      closedAt,
      createdById: user.id,
      updatedById: user.id
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "FailureEvent",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json(created, { status: 201 });
}
