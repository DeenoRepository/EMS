import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { parsePagination, parseSort } from "@/lib/pagination";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { createWorkOrderSchema } from "@/lib/validators/schemas";

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const priority = searchParams.get("priority");
  const equipmentId = searchParams.get("equipmentId");
  const assignedTo = searchParams.get("assignedTo");
  const pagination = parsePagination(searchParams, { pageSize: 20, maxPageSize: 200 });
  const sort = parseSort(searchParams, ["priority", "status", "plannedStartAt", "updatedAt", "createdAt"], "createdAt");

  const where = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { equipmentId: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(status && status !== "all" ? { status: status as any } : {}),
    ...(type && type !== "all" ? { type: type as any } : {}),
    ...(priority && priority !== "all" ? { priority: priority as any } : {}),
    ...(equipmentId ? { equipmentId } : {}),
    ...(assignedTo ? { assignedTo } : {})
  };

  const [items, total] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      orderBy: { [sort.sortBy]: sort.order },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.workOrder.count({ where })
  ]);

  return NextResponse.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "work-order:create" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = createWorkOrderSchema.parse(await req.json());

  const syncedEquipment = await prisma.syncedEquipment.findUnique({ where: { id: payload.equipmentId } });
  if (!syncedEquipment) {
    return NextResponse.json({ error: "Equipment not found in local TOIR registry" }, { status: 400 });
  }

  const plannedStartAt = parseDate(payload.plannedStartAt);
  const plannedEndAt = parseDate(payload.plannedEndAt);
  if (payload.plannedStartAt && !plannedStartAt) {
    return NextResponse.json({ error: "Invalid plannedStartAt" }, { status: 400 });
  }
  if (payload.plannedEndAt && !plannedEndAt) {
    return NextResponse.json({ error: "Invalid plannedEndAt" }, { status: 400 });
  }

  const created = await prisma.workOrder.create({
    data: {
      equipmentId: payload.equipmentId,
      title: payload.title,
      description: payload.description,
      type: payload.type,
      priority: payload.priority,
      status: "NEW",
      sourceFailureId: payload.sourceFailureId,
      relatedTaskId: payload.relatedTaskId,
      assignedTo: payload.assignedTo,
      requestedBy: payload.requestedBy || user.displayName,
      plannedStartAt,
      plannedEndAt,
      slaResponseMinutes: payload.slaResponseMinutes,
      slaResolveMinutes: payload.slaResolveMinutes,
      estimatedLaborHours: payload.estimatedLaborHours,
      estimatedCost: payload.estimatedCost,
      metadata: payload.metadata,
      createdById: user.id,
      updatedById: user.id
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "WorkOrder",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json(created, { status: 201 });
}

