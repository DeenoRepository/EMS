import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { failureUpdateSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { id } = await params;
  const item = await prisma.failureEvent.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "failures:update" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;
  const payload = failureUpdateSchema.parse(await req.json());

  const before = await prisma.failureEvent.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (payload.equipmentId) {
    const eq = await prisma.syncedEquipment.findUnique({ where: { id: payload.equipmentId } });
    if (!eq) return NextResponse.json({ error: "Equipment not found in local TOIR registry" }, { status: 400 });
  }

  const occurredAt = payload.occurredAt ? parseDate(payload.occurredAt) : undefined;
  if (payload.occurredAt && !occurredAt) return NextResponse.json({ error: "Invalid occurredAt" }, { status: 400 });
  const resolvedAt = payload.resolvedAt ? parseDate(payload.resolvedAt) : undefined;
  const dueDate = payload.dueDate ? parseDate(payload.dueDate) : undefined;
  const closedAt = payload.closedAt ? parseDate(payload.closedAt) : undefined;

  const updated = await prisma.failureEvent.update({
    where: { id },
    data: {
      equipmentId: payload.equipmentId,
      equipmentCode: payload.equipmentCode,
      equipmentName: payload.equipmentName,
      occurredAt,
      resolvedAt,
      downtimeMinutes: payload.downtimeMinutes,
      failureNode: payload.failureNode,
      symptom: payload.symptom,
      rootCauseCategory: payload.rootCauseCategory,
      rootCauseDetail: payload.rootCauseDetail,
      severity: payload.severity,
      rcaStatus: payload.rcaStatus,
      correctiveAction: payload.correctiveAction,
      preventiveAction: payload.preventiveAction,
      owner: payload.owner,
      dueDate,
      closedAt,
      updatedById: user.id
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "FailureEvent",
    entityId: updated.id,
    beforeState: before,
    afterState: updated
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(_req);
  const rateLimited = enforceWriteRateLimit(_req, { scope: "failure:delete" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["ADMIN"]);
  const { id } = await params;

  const existing = await prisma.failureEvent.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.failureEvent.delete({ where: { id } });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "DELETE",
    entityType: "FailureEvent",
    entityId: id,
    beforeState: existing
  });

  return NextResponse.json({ success: true });
}
