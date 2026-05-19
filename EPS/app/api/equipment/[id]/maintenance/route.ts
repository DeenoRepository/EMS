import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { equipmentMaintenanceSchema } from "@/lib/validators/schemas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "equipment:maintenance" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;
  const payload = equipmentMaintenanceSchema.parse(await req.json());

  const before = await prisma.equipment.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (before.status === "DECOMMISSIONED") {
    return NextResponse.json({ error: "Decommissioned equipment cannot be moved to maintenance" }, { status: 409 });
  }

  if (payload.mode === "ENTER" && before.lifecycleStage === "MAINTENANCE") {
    return NextResponse.json({ ok: true, skipped: true, reason: "Already in maintenance" });
  }
  if (payload.mode === "EXIT" && before.lifecycleStage !== "MAINTENANCE") {
    return NextResponse.json({ error: "Equipment is not in maintenance mode" }, { status: 409 });
  }

  const summary =
    payload.mode === "ENTER"
      ? payload.comments?.trim() || "Перевод в техническое обслуживание"
      : payload.comments?.trim() || "Вывод из технического обслуживания";

  if (payload.mode === "ENTER") {
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.equipment.update({
        where: { id },
        data: {
          status: "INACTIVE",
          lifecycleStage: "MAINTENANCE"
        }
      });

      await tx.equipmentEvent.create({
        data: {
          equipmentId: id,
          eventType: "STATUS_CHANGED",
          title: "Оборудование переведено в ТО",
          description: summary,
          payload: { mode: "ENTER" },
          actorId: user.id
        }
      });

      return next;
    });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "UPDATE",
      entityType: "EquipmentMaintenance",
      entityId: updated.id,
      beforeState: before,
      afterState: updated,
      metadata: { mode: "ENTER" }
    });

    return NextResponse.json({ ok: true, mode: "ENTER", equipment: updated });
  }

  const marker = `[MAINTENANCE_EXIT:${id}]`;
  const existingPending = await prisma.approvalRequest.findFirst({
    where: {
      targetType: "DOCUMENT_VERSION",
      status: { in: ["DRAFT", "PENDING"] },
      comments: { startsWith: marker }
    }
  });
  if (existingPending) {
    return NextResponse.json({ error: "Вывод из ТО уже отправлен на согласование" }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const actDocument = await tx.document.create({
      data: {
        equipmentId: id,
        title: `Акт выполненных работ ТО ${before.equipmentCode}`,
        docType: "ACT",
        status: "IN_REVIEW"
      }
    });

    const actVersion = await tx.documentVersion.create({
      data: {
        documentId: actDocument.id,
        versionNumber: 1,
        fileName: payload.fileName!.trim(),
        storagePath: payload.storagePath!.trim(),
        checksum: payload.checksum!.trim(),
        notes: payload.notes?.trim() || summary,
        metadata: { source: "maintenance_exit_act", equipmentId: id },
        createdById: user.id
      }
    });

    const approval = await tx.approvalRequest.create({
      data: {
        targetType: "DOCUMENT_VERSION",
        targetId: actVersion.id,
        requestedById: user.id,
        status: "PENDING",
        comments: `${marker} ${summary}`
      }
    });

    await tx.equipmentEvent.create({
      data: {
        equipmentId: id,
        eventType: "DOCUMENT_ATTACHED",
        title: "Акт выполненных работ прикреплен",
        description: actDocument.title,
        payload: {
          documentId: actDocument.id,
          approvalRequestId: approval.id,
          mode: "EXIT",
          source: "maintenance_exit_flow"
        },
        actorId: user.id
      }
    });

    await tx.equipmentEvent.create({
      data: {
        equipmentId: id,
        eventType: "APPROVAL_SUBMITTED",
        title: "Вывод из ТО отправлен на согласование",
        description: summary,
        payload: {
          approvalRequestId: approval.id,
          mode: "EXIT",
          source: "maintenance_exit_flow"
        },
        actorId: user.id
      }
    });

    return {
      maintenanceActId: actDocument.id,
      approvalId: approval.id
    };
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "EquipmentMaintenance",
    entityId: before.id,
    beforeState: before,
    afterState: before,
    metadata: {
      mode: "EXIT_REQUESTED",
      approvalId: result.approvalId,
      maintenanceActId: result.maintenanceActId
    }
  });

  return NextResponse.json({
    ok: true,
    mode: "EXIT_REQUESTED",
    equipment: before,
    maintenanceActId: result.maintenanceActId,
    approvalId: result.approvalId
  });
}
