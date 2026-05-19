import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { isRollbackEnabled } from "@/lib/settings/runtime";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

type Snapshot = {
  equipmentCode?: string;
  name?: string;
  type?: string | null;
  category?: string | null;
  model?: string;
  serialNumber?: string | null;
  inventoryNumber?: string | null;
  department?: string | null;
  location?: string | null;
  responsibleUserId?: string | null;
  manufacturer?: string | null;
  supplier?: string | null;
  productionDate?: string | Date | null;
  deliveryDate?: string | Date | null;
  commissioningDate?: string | Date | null;
  warrantyExpiration?: string | Date | null;
  serviceDueDate?: string | Date | null;
  notes?: string | null;
  status?: "DRAFT" | "ACTIVE" | "INACTIVE" | "DECOMMISSIONED";
  lifecycleStage?: "PLANNED" | "COMMISSIONED" | "IN_OPERATION" | "MAINTENANCE" | "RETIRED";
};

function toDate(value?: string | Date | null) {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "approvals:rollback" });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["APPROVER", "ADMIN"]);
  const { id } = await params;
  const rollbackEnabled = await isRollbackEnabled();

  if (!rollbackEnabled) {
    return NextResponse.json({ error: "Rollback is disabled in project settings" }, { status: 403 });
  }

  const approval = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!approval) {
    return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
  }

  if (approval.status !== "APPROVED") {
    return NextResponse.json({ error: "Rollback is allowed only for approved requests" }, { status: 400 });
  }

  if (approval.targetType !== "EQUIPMENT_VERSION") {
    return NextResponse.json({ error: "Rollback is currently supported only for equipment approvals" }, { status: 400 });
  }

  const sourceVersion = await prisma.equipmentVersion.findUnique({
    where: { id: approval.targetId },
    include: { equipment: true }
  });

  if (!sourceVersion) {
    return NextResponse.json({ error: "Target equipment version not found" }, { status: 404 });
  }

  const snapshot = (sourceVersion.snapshot || {}) as Snapshot;
  const before = sourceVersion.equipment;

  const updated = await prisma.$transaction(async (tx) => {
    const equipment = await tx.equipment.update({
      where: { id: sourceVersion.equipmentId },
      data: {
        equipmentCode: snapshot.equipmentCode ?? before.equipmentCode,
        name: snapshot.name ?? before.name,
        type: snapshot.type ?? before.type,
        category: snapshot.category ?? before.category,
        model: snapshot.model ?? before.model,
        serialNumber: snapshot.serialNumber ?? before.serialNumber,
        inventoryNumber: snapshot.inventoryNumber ?? before.inventoryNumber,
        department: snapshot.department ?? before.department,
        location: snapshot.location ?? before.location,
        responsibleUserId: snapshot.responsibleUserId ?? before.responsibleUserId,
        manufacturer: snapshot.manufacturer ?? before.manufacturer,
        supplier: snapshot.supplier ?? before.supplier,
        productionDate: toDate(snapshot.productionDate) ?? before.productionDate,
        deliveryDate: toDate(snapshot.deliveryDate) ?? before.deliveryDate,
        commissioningDate: toDate(snapshot.commissioningDate) ?? before.commissioningDate,
        warrantyExpiration: toDate(snapshot.warrantyExpiration) ?? before.warrantyExpiration,
        serviceDueDate: toDate(snapshot.serviceDueDate) ?? before.serviceDueDate,
        notes: snapshot.notes ?? before.notes,
        status: snapshot.status ?? before.status,
        lifecycleStage: snapshot.lifecycleStage ?? before.lifecycleStage,
        currentVersion: { increment: 1 }
      }
    });

    await tx.equipmentVersion.create({
      data: {
        equipmentId: equipment.id,
        versionNumber: equipment.currentVersion,
        changeSummary: `Rollback from approval ${approval.id.slice(0, 8)}`,
        snapshot: equipment,
        createdById: user.id
      }
    });

    await tx.equipmentEvent.create({
      data: {
        equipmentId: equipment.id,
        eventType: "UPDATED",
        title: "Выполнен откат версии",
        description: `Откат выполнен по согласованию ${approval.id.slice(0, 8)}`,
        actorId: user.id
      }
    });

    return equipment;
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "EquipmentRollback",
    entityId: updated.id,
    beforeState: before,
    afterState: updated,
    metadata: { approvalId: approval.id, sourceVersionId: sourceVersion.id }
  });

  return NextResponse.json(updated);
}
