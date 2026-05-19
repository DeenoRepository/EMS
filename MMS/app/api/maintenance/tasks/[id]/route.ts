import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { updatePprTaskSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "ppr-task:update" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;
  const payload = updatePprTaskSchema.parse(await req.json());

  const before = await prisma.pprTask.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scheduledDate = payload.scheduledDate ? new Date(payload.scheduledDate) : undefined;
  const performedAt = payload.performedAt ? new Date(payload.performedAt) : undefined;
  if (payload.scheduledDate && Number.isNaN(scheduledDate?.getTime())) {
    return NextResponse.json({ error: "Invalid scheduledDate" }, { status: 400 });
  }
  if (payload.performedAt && Number.isNaN(performedAt?.getTime())) {
    return NextResponse.json({ error: "Invalid performedAt" }, { status: 400 });
  }

  if (payload.equipmentId) {
    const eq = await prisma.syncedEquipment.findUnique({ where: { id: payload.equipmentId } });
    if (!eq) {
      return NextResponse.json({ error: "Equipment not found in local TOIR registry" }, { status: 400 });
    }
  }

  const updated = await prisma.pprTask.update({
    where: { id },
    data: {
      planId: payload.planId,
      equipmentId: payload.equipmentId,
      scheduledDate,
      maintenanceType: payload.maintenanceType,
      status: payload.status,
      performedAt,
      resultNotes: payload.resultNotes,
      laborHours: payload.laborHours,
      totalCost: payload.totalCost,
      spareParts: payload.spareParts,
      warehouseReservationId: payload.warehouseReservationId,
      updatedById: user.id
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "PprTask",
    entityId: updated.id,
    beforeState: before,
    afterState: updated
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(_req);
  const rateLimited = enforceWriteRateLimit(_req, { scope: "ppr-task:delete" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["ADMIN"]);
  const { id } = await params;

  const existing = await prisma.pprTask.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.pprTask.delete({ where: { id } });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "DELETE",
    entityType: "PprTask",
    entityId: id,
    beforeState: existing
  });

  return NextResponse.json({ success: true });
}
