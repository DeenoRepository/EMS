import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { warehouseReservationSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { createWmsReservation } from "@/lib/integrations/wms-client";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "warehouse:reserve" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = warehouseReservationSchema.parse(await req.json());

  let integrationResponse: { status: string; reservationId?: string; payload?: Prisma.InputJsonValue; stub: boolean; warning?: string } = {
    status: "REQUESTED",
    stub: true
  };

  try {
    const wms = await createWmsReservation({
      equipmentId: payload.equipmentId,
      taskId: payload.taskId,
      workOrderId: payload.workOrderId,
      items: payload.items
    });

    integrationResponse = {
      status: wms.status || "REQUESTED",
      reservationId: wms.reservationId,
      payload: (wms.payload ?? null) as Prisma.InputJsonValue,
      stub: false
    };
  } catch (error) {
    integrationResponse = {
      status: "REQUESTED",
      stub: true,
      warning: error instanceof Error ? error.message : "WMS unavailable"
    };
  }

  const created = await prisma.warehouseReservation.create({
    data: {
      equipmentId: payload.equipmentId,
      status: integrationResponse.status as any,
      externalId: integrationResponse.reservationId,
      requiredItems: payload.items,
      response: integrationResponse
    }
  });

  if (payload.taskId) {
    await prisma.pprTask.update({
      where: { id: payload.taskId },
      data: { warehouseReservationId: created.id }
    });
  }

  if (payload.workOrderId) {
    await prisma.workOrder.update({
      where: { id: payload.workOrderId },
      data: { externalWmsId: integrationResponse.reservationId, updatedById: user.id }
    });
  }

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "INTEGRATION",
    entityType: "WarehouseReservation",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json({
    ok: true,
    stub: integrationResponse.stub,
    reservationId: created.id,
    externalReservationId: created.externalId,
    status: created.status,
    warning: integrationResponse.warning
  });
}
