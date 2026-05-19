import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { updateWorkOrderSchema } from "@/lib/validators/schemas";

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { id } = await params;
  const item = await prisma.workOrder.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "work-order:update" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;
  const payload = updateWorkOrderSchema.parse(await req.json());

  const before = await prisma.workOrder.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (payload.equipmentId) {
    const eq = await prisma.syncedEquipment.findUnique({ where: { id: payload.equipmentId } });
    if (!eq) return NextResponse.json({ error: "Equipment not found in local TOIR registry" }, { status: 400 });
  }

  const plannedStartAt = payload.plannedStartAt ? parseDate(payload.plannedStartAt) : undefined;
  const plannedEndAt = payload.plannedEndAt ? parseDate(payload.plannedEndAt) : undefined;
  const actualStartAt = payload.actualStartAt ? parseDate(payload.actualStartAt) : undefined;
  const actualEndAt = payload.actualEndAt ? parseDate(payload.actualEndAt) : undefined;
  if (payload.plannedStartAt && !plannedStartAt) return NextResponse.json({ error: "Invalid plannedStartAt" }, { status: 400 });
  if (payload.plannedEndAt && !plannedEndAt) return NextResponse.json({ error: "Invalid plannedEndAt" }, { status: 400 });
  if (payload.actualStartAt && !actualStartAt) return NextResponse.json({ error: "Invalid actualStartAt" }, { status: 400 });
  if (payload.actualEndAt && !actualEndAt) return NextResponse.json({ error: "Invalid actualEndAt" }, { status: 400 });

  const updated = await prisma.workOrder.update({
    where: { id },
    data: {
      equipmentId: payload.equipmentId,
      title: payload.title,
      description: payload.description,
      type: payload.type,
      priority: payload.priority,
      status: payload.status,
      sourceFailureId: payload.sourceFailureId,
      relatedTaskId: payload.relatedTaskId,
      assignedTo: payload.assignedTo,
      requestedBy: payload.requestedBy,
      plannedStartAt,
      plannedEndAt,
      actualStartAt,
      actualEndAt,
      slaResponseMinutes: payload.slaResponseMinutes,
      slaResolveMinutes: payload.slaResolveMinutes,
      estimatedLaborHours: payload.estimatedLaborHours,
      actualLaborHours: payload.actualLaborHours,
      estimatedCost: payload.estimatedCost,
      actualCost: payload.actualCost,
      downtimeMinutes: payload.downtimeMinutes,
      externalEpsId: payload.externalEpsId,
      externalWmsId: payload.externalWmsId,
      metadata: payload.metadata,
      updatedById: user.id
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "WorkOrder",
    entityId: updated.id,
    beforeState: before,
    afterState: updated
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(_req);
  const rateLimited = enforceWriteRateLimit(_req, { scope: "work-order:delete" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["ADMIN"]);
  const { id } = await params;

  const existing = await prisma.workOrder.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.workOrder.delete({ where: { id } });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "DELETE",
    entityType: "WorkOrder",
    entityId: id,
    beforeState: existing
  });

  return NextResponse.json({ success: true });
}

