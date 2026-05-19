import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { scheduleAssignSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import type { WorkOrderStatus } from "@prisma/client";

function parseDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const assignee = searchParams.get("assignee");

  if (!fromRaw || !toRaw) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const from = parseDate(fromRaw);
  const to = parseDate(toRaw);
  if (!from || !to || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const activeStatuses: WorkOrderStatus[] = ["NEW", "APPROVED", "IN_PROGRESS", "ON_HOLD"];
  const where = {
    status: { in: activeStatuses },
    plannedStartAt: { lte: to },
    plannedEndAt: { gte: from },
    ...(assignee ? { assignedTo: assignee } : {})
  };

  const workOrders = await prisma.workOrder.findMany({
    where,
    orderBy: [{ assignedTo: "asc" }, { plannedStartAt: "asc" }],
    select: {
      id: true,
      equipmentId: true,
      title: true,
      priority: true,
      status: true,
      assignedTo: true,
      plannedStartAt: true,
      plannedEndAt: true,
      estimatedLaborHours: true
    }
  });

  const buckets = new Map<string, { assignee: string; tasks: number; critical: number; estimatedLaborHours: number }>();
  for (const item of workOrders) {
    const key = item.assignedTo || "UNASSIGNED";
    const bucket = buckets.get(key) || { assignee: key, tasks: 0, critical: 0, estimatedLaborHours: 0 };
    bucket.tasks += 1;
    if (item.priority === "CRITICAL") bucket.critical += 1;
    bucket.estimatedLaborHours += Number(item.estimatedLaborHours || 0);
    buckets.set(key, bucket);
  }

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    workOrders,
    loadByAssignee: [...buckets.values()].sort((a, b) => b.tasks - a.tasks)
  });
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "schedule:assign" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = scheduleAssignSchema.parse(await req.json());
  const plannedStartAt = parseDate(payload.plannedStartAt);
  const plannedEndAt = parseDate(payload.plannedEndAt);
  if (!plannedStartAt || !plannedEndAt || plannedStartAt > plannedEndAt) {
    return NextResponse.json({ error: "Invalid planned date range" }, { status: 400 });
  }

  const before = await prisma.workOrder.findUnique({ where: { id: payload.workOrderId } });
  if (!before) return NextResponse.json({ error: "Work order not found" }, { status: 404 });

  const updated = await prisma.workOrder.update({
    where: { id: payload.workOrderId },
    data: {
      assignedTo: payload.assignedTo,
      plannedStartAt,
      plannedEndAt,
      status: payload.status || "APPROVED",
      updatedById: user.id
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "WorkOrderSchedule",
    entityId: updated.id,
    beforeState: before,
    afterState: updated
  });

  return NextResponse.json(updated);
}
