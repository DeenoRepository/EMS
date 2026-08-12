import { prisma } from "@/lib/db/prisma";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";
import { createReservationSchema } from "@/lib/validations/wms";
import { recordWmsOutboxEvent } from "@/lib/wms/outbox-processor";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const reservationsQuerySchema = z.object({
  itemId: z.string().optional(),
  equipmentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/modules/wms/reservations
 *
 * Получить список активных резервов ТМЦ с фильтрацией.
 * Применяется scope-based фильтрация по ответственным складам.
 *
 * @requires Permission: wms.items.read
 * @returns {Promise<{ reservations: WmsReservation[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = reservationsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { itemId, equipmentId, limit, offset } = parseResult.data;

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: Record<string, unknown> = { isActive: true };
    if (itemId) where.itemId = itemId;
    if (equipmentId) where.equipmentId = equipmentId;

    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return createSuccessResponse({ reservations: [], total: 0, limit, offset }, request);
      }
      where.item = {
        warehouse: { in: responsibleWarehouses },
      };
    }

    const [reservations, total] = await Promise.all([
      prisma.wmsReservation.findMany({
        where,
        include: { item: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.wmsReservation.count({ where }),
    ]);

    return createSuccessResponse({ reservations, total, limit, offset }, request);
  } catch (err) {
    console.error("Failed to fetch WMS reservations:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "RESERVATIONS_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка резервов",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/wms/reservations
 *
 * Зарезервировать ТМЦ под ТОИР/ППР.
 * Публикует доменное событие `wms.stock.reserved` через Transactional Outbox.
 *
 * @requires Permission: wms.items.update
 * @returns {Promise<{ success: true, reservation: WmsReservation }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return createErrorResponse(
        "INVALID_JSON",
        "Неверный формат JSON в теле запроса",
        undefined,
        400,
        request
      );
    }

    const body = rawBody as Record<string, unknown>;
    const parseResult = createReservationSchema.safeParse({
      itemId: body.itemId,
      quantity: Number(body.reservedQuantity ?? body.quantity),
      reservedBy: session.displayName || session.username,
      purpose: body.reason || body.purpose,
      notes: body.notes,
    });

    if (!parseResult.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные параметры резервирования ТМЦ (SEC-03)",
        parseResult.error.flatten(),
        400,
        request
      );
    }

    const { itemId, quantity: reservedQuantity, purpose: reason } = parseResult.data;
    const { equipmentId, equipmentName, maintenancePlanDate } = body;

    // Проверка остатка ТМЦ
    const item = await prisma.wmsItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return createErrorResponse(
        "NOT_FOUND",
        "Позиция ТМЦ не найдена",
        undefined,
        404,
        request
      );
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(item.warehouse)) {
      logEvent({
        level: "warn",
        module: "WMS",
        action: "RESERVATION_DENIED_SCOPE",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { warehouse: item.warehouse, allowed: responsibleWarehouses },
      });
      return createErrorResponse(
        "FORBIDDEN",
        `Отказано в доступе. Вы не являетесь МОЛ склада "${item.warehouse}"`,
        undefined,
        403,
        request
      );
    }

    const availableQty = item.quantity - item.reservedQuantity;
    if (reservedQuantity > availableQty) {
      return createErrorResponse(
        "INSUFFICIENT_STOCK",
        `Недостаточно свободного остатка для резерва. Доступно: ${availableQty} ${item.unit}`,
        { available: availableQty, unit: item.unit },
        400,
        request
      );
    }

    const reservedBy = session.displayName || session.username;

    // Транзакция: создание резерва и увеличение reservedQuantity у ТМЦ
    const [reservation] = await prisma.$transaction([
      prisma.wmsReservation.create({
        data: {
          itemId,
          equipmentId: typeof equipmentId === "string" ? equipmentId : null,
          equipmentName: typeof equipmentName === "string" ? equipmentName : null,
          maintenancePlanDate:
            typeof maintenancePlanDate === "string" ? new Date(maintenancePlanDate) : null,
          reservedQuantity,
          reservedBy,
          reason: reason || "Резерв под ППР в ТОИР",
        },
      }),
      prisma.wmsItem.update({
        where: { id: itemId },
        data: {
          reservedQuantity: { increment: reservedQuantity },
        },
      }),
    ]);

    logEvent({
      level: "audit",
      module: "WMS",
      action: "RESERVATION_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        reservationId: reservation.id,
        itemId,
        sku: item.sku,
        reservedQuantity,
      },
    });

    return createSuccessResponse({ success: true, reservation }, request, 201);
  } catch (err) {
    console.error("Failed to create WMS reservation:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "RESERVATION_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка при резервировании ТМЦ под ТОИР",
      undefined,
      500,
      request
    );
  }
}
