import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { approvalDecisionSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

const PPR_PLAN_MARKER = "PPR_PLAN";
type PprMaintenanceType = "PREVENTIVE" | "SEASONAL" | "CAPITAL" | "DIAGNOSTIC";
type PprPlanApprovalPayload = {
  equipmentId: string;
  lastServiceDate: string;
  intervalDays: number;
  horizonMonths: number;
  maintenanceType: PprMaintenanceType;
  intervalMaintenanceTypes?: Array<{ date: string; maintenanceType: PprMaintenanceType }>;
  comments?: string;
};

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parsePprPlanPayload(rawComments?: string | null): PprPlanApprovalPayload | null {
  const comments = (rawComments || "").trim();
  const markerStart = `[${PPR_PLAN_MARKER}:`;
  if (!comments.startsWith(markerStart)) return null;
  const markerEnd = comments.indexOf("]");
  if (markerEnd < 0) return null;
  const jsonPart = comments.slice(markerEnd + 1).trim();
  if (!jsonPart) return null;
  try {
    const parsed = JSON.parse(jsonPart) as Partial<PprPlanApprovalPayload>;
    if (
      !parsed ||
      typeof parsed.equipmentId !== "string" ||
      typeof parsed.lastServiceDate !== "string" ||
      typeof parsed.intervalDays !== "number" ||
      typeof parsed.horizonMonths !== "number" ||
      !["PREVENTIVE", "SEASONAL", "CAPITAL", "DIAGNOSTIC"].includes(String(parsed.maintenanceType))
    ) {
      return null;
    }
    if (parsed.intervalMaintenanceTypes != null) {
      if (!Array.isArray(parsed.intervalMaintenanceTypes)) return null;
      for (const point of parsed.intervalMaintenanceTypes) {
        if (
          !point ||
          typeof point.date !== "string" ||
          !["PREVENTIVE", "SEASONAL", "CAPITAL", "DIAGNOSTIC"].includes(String(point.maintenanceType))
        ) {
          return null;
        }
      }
    }
    return parsed as PprPlanApprovalPayload;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "approvals:decision" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["APPROVER", "ADMIN"]);
  const { id } = await params;
  const payload = approvalDecisionSchema.parse(await req.json());
  const decisionComment = payload.comments?.trim();

  if (payload.status === "REJECTED" && !decisionComment) {
    return NextResponse.json({ error: "Причина отклонения обязательна" }, { status: 400 });
  }

  const before = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
  }
  const resolvedComments =
    (before.comments || "").startsWith("[")
      ? decisionComment
        ? `${before.comments}\n[DECISION]: ${decisionComment}`
        : before.comments
      : decisionComment;
  const isMaintenanceExitFlow = (before.comments || "").startsWith("[MAINTENANCE_EXIT:");
  const pprPlanPayload = parsePprPlanPayload(before.comments);
  const isPprPlanApproval = before.targetType === "EQUIPMENT_VERSION" && Boolean(pprPlanPayload);

  if (payload.status === "APPROVED" && isMaintenanceExitFlow && before.targetType === "DOCUMENT_VERSION") {
    const targetVersion = await prisma.documentVersion.findUnique({
      where: { id: before.targetId },
      include: { document: { select: { equipmentId: true } } }
    });
    if (!targetVersion) {
      return NextResponse.json({ error: "Maintenance act version not found" }, { status: 404 });
    }
    const equipment = await prisma.equipment.findUnique({
      where: { id: targetVersion.document.equipmentId },
      select: { lifecycleStage: true }
    });
    if (!equipment || equipment.lifecycleStage !== "MAINTENANCE") {
      return NextResponse.json(
        { error: "Оборудование не находится в ТО. Вывод из ТО невозможен." },
        { status: 409 }
      );
    }
  }

  if (payload.status === "APPROVED" && isPprPlanApproval && pprPlanPayload) {
    if (before.targetId !== pprPlanPayload.equipmentId) {
      return NextResponse.json({ error: "Неконсистентные данные согласования ППР" }, { status: 409 });
    }
    const lastServiceDate = new Date(pprPlanPayload.lastServiceDate);
    if (Number.isNaN(lastServiceDate.getTime())) {
      return NextResponse.json({ error: "Некорректная дата последнего ТО" }, { status: 400 });
    }
  }

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: payload.status,
      comments: resolvedComments,
      decidedById: user.id,
      decidedAt: new Date()
    }
  });

  let eventEquipmentId: string | null = null;
  let eventTitle = payload.status === "APPROVED" ? "Согласование выполнено" : "Согласование отклонено";
  let eventDescription = decisionComment || undefined;

  if (before.targetType === "DOCUMENT_VERSION") {
    const documentVersion = await prisma.documentVersion.findUnique({
      where: { id: before.targetId },
      include: {
        document: {
          select: {
            id: true,
            equipmentId: true,
            title: true
          }
        }
      }
    });

    if (documentVersion) {
      eventEquipmentId = documentVersion.document.equipmentId;
      eventTitle = payload.status === "APPROVED" ? "Согласование документа выполнено" : "Согласование документа отклонено";
      if (!eventDescription) {
        eventDescription = documentVersion.document.title;
      }

      await prisma.document.update({
        where: { id: documentVersion.document.id },
        data: { status: payload.status === "APPROVED" ? "APPROVED" : "REJECTED" }
      });

      if (payload.status === "APPROVED" && isMaintenanceExitFlow) {
        const equipmentBefore = await prisma.equipment.findUnique({ where: { id: documentVersion.document.equipmentId } });
        if (equipmentBefore && equipmentBefore.lifecycleStage === "MAINTENANCE") {
          const completedServiceDate = new Date().toISOString().slice(0, 10);
          const existingAttributes =
            ((equipmentBefore.customAttributes as Record<string, unknown> | null) || {}) as Record<string, unknown>;
          const intervalDaysRaw = Number(existingAttributes.__ppr_interval_days || 0);
          const nextServiceDate =
            Number.isFinite(intervalDaysRaw) && intervalDaysRaw > 0
              ? addDays(new Date(completedServiceDate), intervalDaysRaw)
              : equipmentBefore.serviceDueDate;
          const nextCustomAttributes: Record<string, unknown> = {
            ...existingAttributes,
            __ppr_last_service_date: completedServiceDate
          };

          const equipmentAfter = await prisma.equipment.update({
            where: { id: equipmentBefore.id },
            data: {
              status: "ACTIVE",
              lifecycleStage: "IN_OPERATION",
              serviceDueDate: nextServiceDate || undefined,
              customAttributes: nextCustomAttributes as Prisma.InputJsonValue,
            }
          });

          await prisma.equipmentEvent.create({
            data: {
              equipmentId: equipmentAfter.id,
              eventType: "STATUS_CHANGED",
              title: "Оборудование выведено из ТО",
              description: "Статус изменен после согласования акта выполненных работ",
              payload: {
                source: "maintenance_exit_flow",
                approvalRequestId: updated.id,
                documentVersionId: documentVersion.id
              },
              actorId: user.id
            }
          });
        }
      }
    }
  } else if (before.targetType === "EQUIPMENT_VERSION") {
    if (isPprPlanApproval && pprPlanPayload) {
      const equipment = await prisma.equipment.findUnique({
        where: { id: pprPlanPayload.equipmentId },
        select: { id: true, equipmentCode: true, customAttributes: true }
      });
      if (equipment) {
        eventEquipmentId = equipment.id;
        eventTitle =
          payload.status === "APPROVED" ? "График ППР согласован" : "Согласование графика ППР отклонено";
        if (!eventDescription) {
          eventDescription = equipment.equipmentCode;
        }

        if (payload.status === "APPROVED") {
          const lastServiceDate = new Date(pprPlanPayload.lastServiceDate);
          const nextServiceDate = addDays(lastServiceDate, pprPlanPayload.intervalDays);
          const intervalMaintenanceTypes = (pprPlanPayload.intervalMaintenanceTypes || []).map((point) => ({
            date: point.date,
            maintenanceType: point.maintenanceType
          }));
          const existingAttributes =
            ((equipment.customAttributes as Record<string, unknown> | null) || {}) as Record<string, unknown>;
          const nextCustomAttributes: Record<string, unknown> = {
            ...existingAttributes,
            __ppr_last_service_date: pprPlanPayload.lastServiceDate,
            __ppr_interval_days: String(pprPlanPayload.intervalDays),
            __ppr_horizon_months: String(pprPlanPayload.horizonMonths),
            __ppr_maintenance_type: pprPlanPayload.maintenanceType,
            __ppr_interval_maintenance_types: JSON.stringify(intervalMaintenanceTypes)
          };

          const applied = await prisma.$transaction(async (tx) => {
            const next = await tx.equipment.update({
              where: { id: equipment.id },
              data: {
                serviceDueDate: nextServiceDate,
                customAttributes: nextCustomAttributes as Prisma.InputJsonValue,
                currentVersion: { increment: 1 }
              }
            });

            await tx.equipmentVersion.create({
              data: {
                equipmentId: next.id,
                versionNumber: next.currentVersion,
                changeSummary: pprPlanPayload.comments || "График ППР согласован",
                snapshot: next,
                createdById: user.id
              }
            });

            await tx.equipmentEvent.create({
              data: {
                equipmentId: next.id,
                eventType: "UPDATED",
                title: "График ППР обновлен",
                description: `Тип ТО: ${pprPlanPayload.maintenanceType}, следующее ТО: ${nextServiceDate.toISOString().slice(0, 10)}`,
                payload: {
                  source: "ppr_plan",
                  approvalRequestId: updated.id,
                  maintenanceType: pprPlanPayload.maintenanceType,
                  intervalMaintenanceTypes,
                  intervalDays: pprPlanPayload.intervalDays,
                  horizonMonths: pprPlanPayload.horizonMonths,
                  lastServiceDate: pprPlanPayload.lastServiceDate
                },
                actorId: user.id
              }
            });

            return next;
          });

          eventDescription = pprPlanPayload.comments || applied.equipmentCode;
        }
      }
    } else {
      const equipmentVersion = await prisma.equipmentVersion.findUnique({
        where: { id: before.targetId },
        include: { equipment: { select: { equipmentCode: true } } }
      });
      if (equipmentVersion) {
        eventEquipmentId = equipmentVersion.equipmentId;
        eventTitle =
          payload.status === "APPROVED"
            ? "Согласование изменений оборудования выполнено"
            : "Согласование изменений оборудования отклонено";
        if (!eventDescription) {
          eventDescription = equipmentVersion.equipment.equipmentCode;
        }
      }
    }
  }

  if (eventEquipmentId) {
    await prisma.equipmentEvent.create({
      data: {
        equipmentId: eventEquipmentId,
        eventType: "APPROVAL_RESOLVED",
        title: eventTitle,
        description: eventDescription,
        payload: {
          approvalStatus: payload.status,
          targetType: before.targetType,
          targetId: before.targetId,
          approvalRequestId: updated.id
        },
        actorId: user.id
      }
    });
  }

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: payload.status === "APPROVED" ? "APPROVE" : "REJECT",
    entityType: "ApprovalRequest",
    entityId: updated.id,
    beforeState: before,
    afterState: updated
  });

  return NextResponse.json(updated);
}
