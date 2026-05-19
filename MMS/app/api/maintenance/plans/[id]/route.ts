import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { updatePprPlanSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { id } = await params;
  const item = await prisma.pprPlan.findUnique({ where: { id }, include: { tasks: true } });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "ppr-plan:update" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;
  const payload = updatePprPlanSchema.parse(await req.json());

  const before = await prisma.pprPlan.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lastServiceDate = payload.lastServiceDate ? new Date(payload.lastServiceDate) : undefined;
  if (payload.lastServiceDate && Number.isNaN(lastServiceDate?.getTime())) {
    return NextResponse.json({ error: "Invalid lastServiceDate" }, { status: 400 });
  }

  let syncedEquipment: { equipmentCode: string | null; name: string } | null = null;
  if (payload.equipmentId) {
    const eq = await prisma.syncedEquipment.findUnique({ where: { id: payload.equipmentId } });
    if (!eq) {
      return NextResponse.json({ error: "Equipment not found in local TOIR registry" }, { status: 400 });
    }
    syncedEquipment = { equipmentCode: eq.equipmentCode ?? null, name: eq.name };
  }

  const intervalDays = payload.intervalDays ?? before.intervalDays;
  const lastDateForNext = lastServiceDate ?? before.lastServiceDate;
  const nextServiceDate = new Date(lastDateForNext);
  nextServiceDate.setDate(nextServiceDate.getDate() + intervalDays);

  const updated = await prisma.pprPlan.update({
    where: { id },
    data: {
      equipmentId: payload.equipmentId,
      equipmentCode: syncedEquipment?.equipmentCode || payload.equipmentCode,
      equipmentName: syncedEquipment?.name || payload.equipmentName,
      maintenanceType: payload.maintenanceType,
      intervalDays: payload.intervalDays,
      horizonMonths: payload.horizonMonths,
      lastServiceDate,
      nextServiceDate,
      comments: payload.comments,
      status: payload.status,
      updatedById: user.id
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "PprPlan",
    entityId: updated.id,
    beforeState: before,
    afterState: updated
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(_req);
  const rateLimited = enforceWriteRateLimit(_req, { scope: "ppr-plan:delete" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["ADMIN"]);
  const { id } = await params;

  const existing = await prisma.pprPlan.findUnique({ where: { id }, include: { tasks: true } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.tasks.length > 0) {
    return NextResponse.json({ error: "Cannot delete plan with existing tasks. Delete tasks first." }, { status: 400 });
  }

  await prisma.pprPlan.delete({ where: { id } });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "DELETE",
    entityType: "PprPlan",
    entityId: id,
    beforeState: existing
  });

  return NextResponse.json({ success: true });
}
