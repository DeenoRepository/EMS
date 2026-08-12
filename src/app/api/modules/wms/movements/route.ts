import { prisma } from "@/lib/db/prisma";
import { WmsMovementType } from "@prisma/client";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";
import { recordWmsOutboxEvent } from "@/lib/wms/outbox-processor";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const movementItemSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(["INCOMING", "OUTGOING", "TRANSFER", "PERSONAL_CARD", "ADJUSTMENT", "WRITE_OFF"]),
  quantity: z.coerce.number().int().positive(),
  fromLocation: z.string().optional(),
  toLocation: z.string().optional(),
  performedBy: z.string().optional(),
  reason: z.string().optional(),
  relatedOrderOrEq: z.string().optional(),
  workOrderId: z.string().optional(),
});

const movementsQuerySchema = z.object({
  itemId: z.string().optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/modules/wms/movements
 *
 * Получить список движений ТМЦ с фильтрацией по itemId и типу.
 * Применяется scope-based фильтрация по ответственным складам.
 *
 * @requires Permission: wms.movements.execute
 * @returns {Promise<{ movements: WmsMovement[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = movementsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { itemId, type, limit, offset } = parseResult.data;

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: Record<string, unknown> = {};

    if (itemId) where.itemId = itemId;
    if (type) where.type = type as WmsMovementType;

    // SEC-09: Scope-based фильтрация по складам МОЛ
    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return createSuccessResponse({ movements: [], total: 0, limit, offset }, request);
      }
      where.item = {
        warehouse: { in: responsibleWarehouses },
      };
    }

    const [movements, total] = await Promise.all([
      prisma.wmsMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.wmsMovement.count({ where }),
    ]);

    return createSuccessResponse({ movements, total, limit, offset }, request);
  } catch (err) {
    console.error("WMS Movements query failed:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "MOVEMENTS_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка движений",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/wms/movements
 *
 * Провести движение ТМЦ (приход/расход/перемещение/списание).
 * Поддерживает batch-обработку через массив items.
 * Публикует доменное событие через Transactional Outbox.
 *
 * @requires Permission: wms.movements.execute
 * @returns {Promise<{ success: true, count: number }>}
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

    // Поддержка batch-обработки
    const itemsList = Array.isArray((body as { items?: unknown[] }).items)
      ? (body as { items: unknown[] }).items
      : [body];

    if (itemsList.length === 0) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Список позиций для проведения пуст",
        undefined,
        400,
        request
      );
    }

    const validatedItems: z.infer<typeof movementItemSchema>[] = [];
    for (const entry of itemsList) {
      const parseResult = movementItemSchema.safeParse(entry);
      if (!parseResult.success) {
        return createErrorResponse(
          "VALIDATION_ERROR",
          "Некорректные параметры движения",
          parseResult.error.flatten(),
          400,
          request
        );
      }
      validatedItems.push(parseResult.data);
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const sessionUser = session.displayName || session.username;

    await prisma.$transaction(async (tx) => {
      for (const entry of validatedItems) {
        const { itemId, type, quantity, fromLocation, toLocation, reason, relatedOrderOrEq, workOrderId } = entry;

        const item = await tx.wmsItem.findUnique({ where: { id: itemId } });
        if (!item) {
          throw new Error(`NOT_FOUND:${itemId}`);
        }

        if (responsibleWarehouses !== null && !responsibleWarehouses.includes(item.warehouse)) {
          throw new Error(`FORBIDDEN:${item.warehouse}`);
        }

        let newQuantity = item.quantity;
        if (type === "INCOMING") {
          newQuantity += quantity;
        } else if (type === "OUTGOING" || type === "PERSONAL_CARD" || type === "TRANSFER") {
          if (item.quantity < quantity) {
            throw new Error(`INSUFFICIENT_STOCK:${item.name}:${item.quantity}:${item.unit}`);
          }
          newQuantity -= quantity;
        } else if (type === "WRITE_OFF") {
          if (item.quantity < quantity) {
            throw new Error(`INSUFFICIENT_STOCK:${item.name}:${item.quantity}:${item.unit}`);
          }
          newQuantity -= quantity;
        } else if (type === "ADJUSTMENT") {
          newQuantity = quantity;
        }

        const updatedStatus =
          newQuantity <= 0
            ? "OUT_OF_STOCK"
            : newQuantity <= item.minQuantity
              ? "LOW_STOCK"
              : "IN_STOCK";

        await tx.wmsItem.update({
          where: { id: itemId },
          data: { quantity: newQuantity, status: updatedStatus, updatedAt: new Date() },
        });

        const movement = await tx.wmsMovement.create({
          data: {
            itemId,
            itemSku: item.sku,
            itemName: item.name,
            type,
            quantity,
            fromLocation: fromLocation || item.warehouse,
            toLocation: toLocation || item.cell || item.warehouse,
            performedBy: sessionUser,
            reason: reason || `${type} ${quantity} ${item.unit}`,
            relatedOrderOrEq: relatedOrderOrEq || null,
            workOrderId: workOrderId || null,
          },
        });

        // Публикация доменного события через Transactional Outbox
        const eventName =
          type === "INCOMING"
            ? "wms.stock.received"
            : type === "OUTGOING"
              ? "wms.stock.issued"
              : type === "TRANSFER"
                ? "wms.transfer.requested"
                : type === "WRITE_OFF"
                  ? "wms.writeoff.created"
                  : "wms.stock.adjusted";

        await recordWmsOutboxEvent(tx, {
          eventName,
          aggregateType: "WmsItem",
          aggregateId: itemId,
          payload: {
            itemId,
            sku: item.sku,
            name: item.name,
            type,
            quantity,
            totalQuantity: newQuantity,
            movementId: movement.id,
            performedBy: sessionUser,
          },
        });
      }
    });

    logEvent({
      level: "audit",
      module: "WMS",
      action: "MOVEMENTS_EXECUTED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { count: validatedItems.length },
    });

    return createSuccessResponse(
      { success: true, count: validatedItems.length },
      request,
      201
    );
  } catch (err) {
    console.error("WMS Movements POST failed:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "MOVEMENTS_EXECUTE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка проведения движения ТМЦ",
      undefined,
      500,
      request
    );
  }
}
