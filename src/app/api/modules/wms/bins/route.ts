import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const binsQuerySchema = z.object({
  warehouseId: z.string().optional(),
});

const createZoneSchema = z.object({
  action: z.literal("create_zone"),
  warehouseId: z.string().min(1, "Не указан склад"),
  code: z.string().min(1, "Код зоны обязателен"),
  name: z.string().min(1, "Название зоны обязательно"),
  description: z.string().optional(),
});

const createCellSchema = z.object({
  action: z.literal("create_cell"),
  warehouseId: z.string().min(1, "Не указан склад"),
  code: z.string().min(1, "Код ячейки обязателен"),
  zoneId: z.string().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  description: z.string().optional(),
});

const topologyActionSchema = z.union([createZoneSchema, createCellSchema]);

/**
 * GET /api/modules/wms/bins
 *
 * Получить топологию склада (зоны и ячейки).
 *
 * @requires Permission: wms.topology.manage
 * @returns {Promise<{ zones: WmsZone[], cells: StorageCell[] }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = binsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { warehouseId } = parseResult.data;

  try {
    const where: Record<string, unknown> = {};
    if (warehouseId) where.warehouseId = warehouseId;

    const [zones, cells] = await Promise.all([
      prisma.wmsZone.findMany({ where, orderBy: { code: "asc" } }),
      prisma.storageCell.findMany({ where, include: { zone: true }, orderBy: { code: "asc" } }),
    ]);

    return createSuccessResponse({ zones, cells }, request);
  } catch (err) {
    console.error("Failed to fetch WMS storage topology:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "TOPOLOGY_FETCH_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения топологии склада",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/wms/bins
 *
 * Создать зону или ячейку на складе (только МОЛ склада).
 *
 * @requires Permission: wms.topology.manage
 * @returns {Promise<{ success: true, zone?: WmsZone, cell?: StorageCell }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(
        "INVALID_JSON",
        "Неверный формат JSON в теле запроса",
        undefined,
        400,
        request
      );
    }

    const validation = topologyActionSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Неизвестное действие (action) или некорректные параметры",
        validation.error.flatten(),
        400,
        request
      );
    }

    const data = validation.data;

    // Check warehouse MOL / Admin authorization
    const targetWh = await prisma.warehouse.findUnique({ where: { id: data.warehouseId } });
    if (!targetWh) {
      return createErrorResponse(
        "NOT_FOUND",
        "Склад не найден",
        undefined,
        404,
        request
      );
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(targetWh.name)) {
      logEvent({
        level: "warn",
        module: "WMS",
        action: "TOPOLOGY_DENIED_SCOPE",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { warehouse: targetWh.name, allowed: responsibleWarehouses },
      });
      return createErrorResponse(
        "FORBIDDEN",
        `Отказано в доступе. Редактирование топологии склада "${targetWh.name}" разрешено только МОЛ данного склада.`,
        undefined,
        403,
        request
      );
    }

    if (data.action === "create_zone") {
      const zone = await prisma.wmsZone.create({
        data: {
          warehouseId: data.warehouseId,
          code: data.code,
          name: data.name,
          description: data.description || null,
        },
      });

      logEvent({
        level: "audit",
        module: "WMS",
        action: "ZONE_CREATED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { zoneId: zone.id, code: zone.code, warehouseId: data.warehouseId },
      });

      return createSuccessResponse({ success: true, zone }, request, 201);
    }

    // create_cell
    const cell = await prisma.storageCell.create({
      data: {
        warehouseId: data.warehouseId,
        zoneId: data.zoneId || null,
        code: data.code,
        description: data.description || null,
        capacity: data.capacity || 100,
      },
    });

    logEvent({
      level: "audit",
      module: "WMS",
      action: "CELL_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { cellId: cell.id, code: cell.code, warehouseId: data.warehouseId },
    });

    return createSuccessResponse({ success: true, cell }, request, 201);
  } catch (err) {
    const errCode = (err as { code?: string }).code;
    if (errCode === "P2002") {
      return createErrorResponse(
        "CONFLICT",
        "Зона или ячейка с таким кодом уже существует на этом складе",
        undefined,
        409,
        request
      );
    }
    console.error("Failed to update WMS topology:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "TOPOLOGY_UPDATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка при сохранении топологии склада",
      undefined,
      500,
      request
    );
  }
}
