import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { Prisma, TaskStatus, WarehouseReservationStatus, WorkOrderStatus } from "@prisma/client";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function verifyWebhookToken(req: NextRequest, envKey: string) {
  const expected = process.env[envKey]?.trim();
  if (!expected) return true;
  const actual = req.headers.get("x-webhook-token")?.trim();
  return actual === expected;
}

const allowedStatuses = new Set(["DRAFT", "REQUESTED", "RESERVED", "ISSUED", "CANCELED"]);
const statusPriority: Record<WarehouseReservationStatus, number> = {
  DRAFT: 0,
  REQUESTED: 1,
  RESERVED: 2,
  ISSUED: 3,
  CANCELED: 4
};

function toStatus(value: string) {
  return value as WarehouseReservationStatus;
}

function shouldIgnoreAsStale(current: WarehouseReservationStatus, incoming: WarehouseReservationStatus) {
  if (current === incoming) return false;
  if (incoming === "CANCELED") return false;
  return statusPriority[incoming] < statusPriority[current];
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function buildEventKey(payload: Record<string, unknown>, reservationId: string, status: WarehouseReservationStatus) {
  const eventId = typeof payload.eventId === "string" ? payload.eventId.trim() : "";
  if (eventId) return eventId;
  const ts = typeof payload.timestamp === "string" ? payload.timestamp : "";
  const source = typeof payload.source === "string" ? payload.source : "";
  return `${reservationId}:${status}:${ts}:${source}`;
}

function extractEventHistory(response: Prisma.JsonValue | null | undefined) {
  if (!response || typeof response !== "object" || Array.isArray(response)) return [] as string[];
  const raw = (response as Record<string, unknown>).webhookEventKeys;
  if (!Array.isArray(raw)) return [] as string[];
  return raw.filter((item): item is string => typeof item === "string");
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookToken(req, "WMS_WEBHOOK_TOKEN")) return unauthorized();

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payloadObj = payload as Record<string, unknown>;
  const externalReservationId = String(payloadObj.reservationId || "");
  const statusRaw = String(payloadObj.status || "").toUpperCase();
  if (!externalReservationId || !statusRaw || !allowedStatuses.has(statusRaw)) {
    return NextResponse.json({ error: "reservationId and valid status are required" }, { status: 400 });
  }
  const incomingStatus = toStatus(statusRaw);

  const reservation = await prisma.warehouseReservation.findFirst({
    where: { externalId: externalReservationId }
  });
  if (!reservation) {
    return NextResponse.json({ ok: true, ignored: true, reason: "reservation_not_found" });
  }

  const eventKey = buildEventKey(payloadObj, externalReservationId, incomingStatus);
  const existingEventKeys = extractEventHistory(reservation.response as Prisma.JsonValue | null);
  if (existingEventKeys.includes(eventKey)) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      reservationId: reservation.id,
      status: reservation.status
    });
  }

  if (shouldIgnoreAsStale(reservation.status, incomingStatus)) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "stale_status",
      reservationId: reservation.id,
      currentStatus: reservation.status,
      incomingStatus
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const mergedResponse = {
      ...(reservation.response && typeof reservation.response === "object" && !Array.isArray(reservation.response)
        ? (reservation.response as Record<string, unknown>)
        : {}),
      lastWebhookPayload: payloadObj,
      lastWebhookAt: new Date().toISOString(),
      webhookEventKeys: [...existingEventKeys, eventKey].slice(-50)
    };

    const updatedReservation = await tx.warehouseReservation.update({
      where: { id: reservation.id },
      data: {
        status: incomingStatus,
        response: mergedResponse as Prisma.InputJsonValue
      }
    });

    const linkedTasks = await tx.pprTask.findMany({
      where: { warehouseReservationId: reservation.id },
      select: { id: true, status: true, performedAt: true }
    });
    const taskUpdates: Array<{ id: string; from: TaskStatus; to: TaskStatus }> = [];
    const completedAt = parseDate(payloadObj.completedAt);
    const workCompleted = payloadObj.workCompleted === true || Boolean(completedAt);
    const completionTs = completedAt || new Date();

    for (const task of linkedTasks) {
      let nextStatus: TaskStatus | null = null;
      let nextPerformedAt = task.performedAt;
      if (workCompleted) {
        if (task.status !== "COMPLETED" && task.status !== "CANCELED") {
          nextStatus = "COMPLETED";
          nextPerformedAt = completionTs;
        }
      } else {
      if (incomingStatus === "ISSUED" && task.status === "PLANNED") nextStatus = "IN_PROGRESS";
      if (incomingStatus === "CANCELED" && task.status === "IN_PROGRESS") nextStatus = "PLANNED";
      }
      if (!nextStatus || nextStatus === task.status) continue;

      await tx.pprTask.update({
        where: { id: task.id },
        data: {
          status: nextStatus,
          performedAt: incomingStatus === "CANCELED" ? null : nextPerformedAt
        }
      });
      taskUpdates.push({ id: task.id, from: task.status, to: nextStatus });
    }

    const linkedOrders = await tx.workOrder.findMany({
      where: { externalWmsId: externalReservationId },
      select: { id: true, status: true, actualStartAt: true }
    });
    const workOrderUpdates: Array<{ id: string; from: WorkOrderStatus; to: WorkOrderStatus }> = [];
    for (const order of linkedOrders) {
      let nextStatus: WorkOrderStatus | null = null;
      if (workCompleted) {
        if (order.status !== "COMPLETED" && order.status !== "CANCELED") nextStatus = "COMPLETED";
      } else {
        if (incomingStatus === "REQUESTED" && order.status === "NEW") nextStatus = "APPROVED";
        if (incomingStatus === "RESERVED" && ["NEW", "ON_HOLD"].includes(order.status)) nextStatus = "APPROVED";
        if (incomingStatus === "ISSUED" && ["NEW", "APPROVED", "ON_HOLD"].includes(order.status)) nextStatus = "IN_PROGRESS";
        if (incomingStatus === "CANCELED" && ["NEW", "APPROVED", "IN_PROGRESS"].includes(order.status)) nextStatus = "ON_HOLD";
      }

      if (nextStatus && nextStatus !== order.status) {
        await tx.workOrder.update({
          where: { id: order.id },
          data: {
            status: nextStatus,
            actualStartAt:
              incomingStatus === "ISSUED" || workCompleted ? order.actualStartAt || new Date() : order.actualStartAt,
            actualEndAt: nextStatus === "COMPLETED" ? completionTs : null
          }
        });
        workOrderUpdates.push({ id: order.id, from: order.status, to: nextStatus });
      } else {
        await tx.workOrder.update({
          where: { id: order.id },
          data: { updatedAt: new Date() }
        });
      }
    }

    return { updatedReservation, taskUpdates, workOrderUpdates };
  });

  await writeAuditLog({
    action: "INTEGRATION",
    entityType: "WMSWebhook",
    entityId: updated.updatedReservation.id,
    metadata: {
      status: incomingStatus,
      eventKey,
      taskUpdates: updated.taskUpdates,
      workOrderUpdates: updated.workOrderUpdates
    },
    afterState: payloadObj as any
  });

  return NextResponse.json({
    ok: true,
    reservationId: updated.updatedReservation.id,
    status: updated.updatedReservation.status,
    taskUpdates: updated.taskUpdates.length,
    workOrderUpdates: updated.workOrderUpdates.length
  });
}
