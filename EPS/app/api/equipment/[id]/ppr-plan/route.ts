import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { equipmentPprPlanSchema } from "@/lib/validators/schemas";

const PPR_PLAN_MARKER = "PPR_PLAN";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "equipment:ppr-plan" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;
  const payload = equipmentPprPlanSchema.parse(await req.json());

  const before = await prisma.equipment.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (before.status === "DECOMMISSIONED") {
    return NextResponse.json({ error: "Списанное оборудование не может иметь активный график ППР" }, { status: 409 });
  }

  const lastServiceDate = new Date(payload.lastServiceDate);
  if (Number.isNaN(lastServiceDate.getTime())) {
    return NextResponse.json({ error: "Некорректная дата последнего ТО" }, { status: 400 });
  }

  const marker = `[${PPR_PLAN_MARKER}:${id}]`;
  const existingPending = await prisma.approvalRequest.findFirst({
    where: {
      targetType: "EQUIPMENT_VERSION",
      targetId: id,
      status: { in: ["DRAFT", "PENDING"] },
      comments: { startsWith: marker }
    }
  });
  if (existingPending) {
    return NextResponse.json({ error: "По графику ППР уже есть активная заявка на согласование" }, { status: 409 });
  }

  const approvalPayload = {
    equipmentId: id,
    lastServiceDate: payload.lastServiceDate,
    intervalDays: payload.intervalDays,
    horizonMonths: payload.horizonMonths,
    maintenanceType: payload.maintenanceType,
    intervalMaintenanceTypes: payload.intervalMaintenanceTypes || [],
    comments: payload.comments?.trim() || ""
  };
  const summary = payload.comments?.trim() || "Обновление графика ППР";

  const created = await prisma.$transaction(async (tx) => {
    const approval = await tx.approvalRequest.create({
      data: {
        targetType: "EQUIPMENT_VERSION",
        targetId: id,
        requestedById: user.id,
        status: "PENDING",
        comments: `${marker} ${JSON.stringify(approvalPayload)}`
      }
    });

    await tx.equipmentEvent.create({
      data: {
        equipmentId: id,
        eventType: "APPROVAL_SUBMITTED",
        title: "График ППР отправлен на согласование",
        description: summary,
        payload: {
          source: "ppr_plan",
          approvalRequestId: approval.id,
          maintenanceType: payload.maintenanceType,
          intervalMaintenanceTypesCount: approvalPayload.intervalMaintenanceTypes.length
        },
        actorId: user.id
      }
    });

    return approval;
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "EquipmentPprPlanApproval",
    entityId: created.id,
    beforeState: before,
    afterState: created,
    metadata: {
      intervalDays: payload.intervalDays,
      horizonMonths: payload.horizonMonths,
      lastServiceDate: payload.lastServiceDate,
      maintenanceType: payload.maintenanceType,
      intervalMaintenanceTypesCount: approvalPayload.intervalMaintenanceTypes.length
    }
  });

  return NextResponse.json({
    ok: true,
    mode: "SUBMITTED",
    approvalId: created.id
  });
}
