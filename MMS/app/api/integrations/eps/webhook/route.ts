import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function verifyWebhookToken(req: NextRequest, envKey: string) {
  const expected = process.env[envKey]?.trim();
  if (!expected) return true;
  const actual = req.headers.get("x-webhook-token")?.trim();
  return actual === expected;
}

function parseIso(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseVersion(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function buildEventKey(payload: Record<string, unknown>, equipmentId: string, eventType: string) {
  const eventId = typeof payload.eventId === "string" ? payload.eventId.trim() : "";
  if (eventId) return eventId;
  const ts = typeof payload.timestamp === "string" ? payload.timestamp : "";
  const source = typeof payload.source === "string" ? payload.source : "";
  return `${equipmentId}:${eventType}:${ts}:${source}`;
}

function extractEventHistory(payload: Prisma.JsonValue | null | undefined) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [] as string[];
  const raw = (payload as Record<string, unknown>)._webhookEventKeys;
  if (!Array.isArray(raw)) return [] as string[];
  return raw.filter((x): x is string => typeof x === "string");
}

function extractStoredVersion(payload: Prisma.JsonValue | null | undefined) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return parseVersion((payload as Record<string, unknown>)._sourceVersion);
}

function shouldIgnoreAsStale(params: {
  currentUpdatedAt: Date | null;
  incomingUpdatedAt: Date | null;
  currentVersion: number | null;
  incomingVersion: number | null;
}) {
  const { currentUpdatedAt, incomingUpdatedAt, currentVersion, incomingVersion } = params;

  if (currentVersion !== null && incomingVersion !== null) {
    return incomingVersion < currentVersion;
  }

  if (currentUpdatedAt && incomingUpdatedAt) {
    return incomingUpdatedAt.getTime() < currentUpdatedAt.getTime();
  }

  return false;
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookToken(req, "EPS_WEBHOOK_TOKEN")) return unauthorized();

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payloadObj = payload as Record<string, unknown>;
  const eventType = String(payloadObj.eventType || "");
  const data = (payloadObj.data || {}) as Record<string, unknown>;
  const equipmentId = String(data.id || "");
  if (!eventType || !equipmentId) {
    return NextResponse.json({ error: "eventType and data.id are required" }, { status: 400 });
  }

  if (!["equipment.created", "equipment.updated", "equipment.deleted"].includes(eventType)) {
    return NextResponse.json({ ok: true, ignored: true, reason: "unsupported_event", eventType });
  }

  const incomingUpdatedAt = parseIso(data.sourceUpdatedAt ?? payloadObj.timestamp ?? data.updatedAt);
  const incomingVersion = parseVersion(data.version ?? payloadObj.version);
  const eventKey = buildEventKey(payloadObj, equipmentId, eventType);

  const existing = await prisma.syncedEquipment.findUnique({ where: { id: equipmentId } });
  const eventHistory = extractEventHistory(existing?.payload as Prisma.JsonValue | null);
  if (eventHistory.includes(eventKey)) {
    return NextResponse.json({ ok: true, duplicate: true, equipmentId, eventType });
  }

  const stale = shouldIgnoreAsStale({
    currentUpdatedAt: existing?.sourceUpdatedAt || null,
    incomingUpdatedAt,
    currentVersion: extractStoredVersion(existing?.payload as Prisma.JsonValue | null),
    incomingVersion
  });

  if (stale) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "stale_event",
      equipmentId,
      eventType,
      currentSourceUpdatedAt: existing?.sourceUpdatedAt?.toISOString() || null,
      incomingSourceUpdatedAt: incomingUpdatedAt?.toISOString() || null
    });
  }

  if (eventType === "equipment.deleted") {
    if (existing) {
      await prisma.syncedEquipment.delete({ where: { id: equipmentId } });
    }

    await writeAuditLog({
      action: "INTEGRATION",
      entityType: "EPSWebhook",
      entityId: equipmentId,
      metadata: { eventType, eventKey, incomingVersion, incomingUpdatedAt },
      afterState: data
    });

    return NextResponse.json({ ok: true, equipmentId, deleted: Boolean(existing) });
  }

  const mergedPayload = {
    ...(existing?.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? (existing.payload as Record<string, unknown>)
      : {}),
    ...data,
    _webhookEventKeys: [...eventHistory, eventKey].slice(-100),
    _sourceVersion: incomingVersion,
    _lastWebhookAt: new Date().toISOString(),
    _lastWebhookEventType: eventType
  } as Prisma.InputJsonValue;

  const upserted = await prisma.syncedEquipment.upsert({
    where: { id: equipmentId },
    update: {
      equipmentCode: (data.equipmentCode as string) || null,
      name: (data.name as string) || "Unnamed equipment",
      type: (data.type as string) || null,
      category: (data.category as string) || null,
      model: (data.model as string) || null,
      serialNumber: (data.serialNumber as string) || null,
      inventoryNumber: (data.inventoryNumber as string) || null,
      department: (data.department as string) || null,
      location: (data.location as string) || null,
      status: (data.status as string) || null,
      lifecycleStage: (data.lifecycleStage as string) || null,
      sourceUpdatedAt: incomingUpdatedAt || existing?.sourceUpdatedAt || null,
      payload: mergedPayload,
      lastSyncedAt: new Date()
    },
    create: {
      id: equipmentId,
      equipmentCode: (data.equipmentCode as string) || null,
      name: (data.name as string) || "Unnamed equipment",
      type: (data.type as string) || null,
      category: (data.category as string) || null,
      model: (data.model as string) || null,
      serialNumber: (data.serialNumber as string) || null,
      inventoryNumber: (data.inventoryNumber as string) || null,
      department: (data.department as string) || null,
      location: (data.location as string) || null,
      status: (data.status as string) || null,
      lifecycleStage: (data.lifecycleStage as string) || null,
      sourceUpdatedAt: incomingUpdatedAt,
      payload: mergedPayload,
      lastSyncedAt: new Date()
    }
  });

  await writeAuditLog({
    action: "INTEGRATION",
    entityType: "EPSWebhook",
    entityId: equipmentId,
    metadata: { eventType, eventKey, incomingVersion, incomingUpdatedAt },
    afterState: data
  });

  return NextResponse.json({ ok: true, equipmentId: upserted.id, eventType });
}
