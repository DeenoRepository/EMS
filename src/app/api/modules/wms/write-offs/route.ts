import { prisma } from "@/lib/db/prisma";
import { WmsWriteOffReason } from "@prisma/client";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";
import { createWriteOffSchema } from "@/lib/validations/wms";
import { recordWmsOutboxEvent } from "@/lib/wms/outbox-processor";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const writeOffsQuerySchema = z.object({
  itemId: z.string().optional(),
  reason: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/modules/wms/write-offs
 *
 * Получить список актов списания ТМЦ с фильтрацией.
 * Применяется scope-based фильтрация по ответственным складам.
 *
 * @requires Permission: wms.writeoffs.manage
 * @returns {Promise<{ writeOffs: WmsWriteOff[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = writeOffsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { itemId, reason, limit, offset } = parseResult.data;

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: Record<string, unknown> = {};
    if (itemId) where.itemId = itemId;
    if (reason) where.reason = reason as WmsWriteOffReason;

    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return createSuccessResponse({ writeOffs: [], total: 0, limit, offset }, request);
      }
      where.item = {
        warehouse: { in: responsibleWarehouses },
      };
    }

    const [writeOffs, total] = await Promise.all([
      prisma.wmsWriteOff.findMany({
        where,
        include: { item: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.wmsWriteOff.count({ where }),
    ]);

    return createSuccessResponse({ writeOffs, total, limit, offset }, request);
  } catch (err) {
    console.error("Failed to fetch WMS write-offs:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "WRITEOFFS_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка списаний",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/wms/write-offs
 *
 * Оформить акт списания ТМЦ с проверкой остатков и scope.
 * Публикует доменное событие `wms.writeoff.created` через Transactional Outbox.
 *
 * @requires Permission: wms.writeoffs.manage
 * @returns {Promise<{ success: true, writeOff: WmsWriteOff }>}
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
    const parseResult = createWriteOffSchema.safeParse({
      itemId: body.itemId,
      quantity: Number(body.quantity),
      reason: body.reason || "EQUIPMENT_REPAIR",
      approvedBy: session.displayName || session.username,
      equipmentId: body.equipmentId,
      notes: body.comments,
    });

    if (!parseResult.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные параметры списания ТМЦ (SEC-03)",
        parseResult.error.flatten(),
        400,
        request
      );
    }

    const { itemId, quantity, reason } = parseResult.data;
    const { equipmentId, equipmentName, comments } = body;

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
        action: "WRITEOFF_DENIED_SCOPE",
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

    const availableQuantity = item.quantity - item.reservedQuantity;
    if (quantity > availableQuantity) {
      return createErrorResponse(
        "INSUFFICIENT_STOCK",
        `Нельзя списать больше доступного остатка (с учетом резерва). Доступно к списанию: ${availableQuantity} ${item.unit} (Всего: ${item.quantity}, Зарезервировано: ${item.reservedQuantity})`,
        { available: availableQuantity, total: item.quantity, reserved: item.reservedQuantity },
        400,
        request
      );
    }

    const performedBy = session.displayName || session.username;
    const newQty = item.quantity - quantity;

    const writeOff = await prisma.$transaction(async (tx) => {
      const wo = await tx.wmsWriteOff.create({
        data: {
          itemId,
          quantity,
          reason: reason as WmsWriteOffReason,
          approvedBy: performedBy,
          equipmentId: typeof equipmentId === "string" ? equipmentId : null,
          equipmentName: typeof equipmentName === "string" ? equipmentName : null,
          notes: typeof comments === "string" ? comments : null,
        },
      });

      await tx.wmsItem.update({
        where: { id: itemId },
        data: {
          quantity: newQty,
          status: newQty <= 0 ? "OUT_OF_STOCK" : newQty <= item.minQuantity ? "LOW_STOCK" : "IN_STOCK",
          updatedAt: new Date(),
        },
      });

      await tx.wmsMovement.create({
        data: {
          itemId,
          itemSku: item.sku,
          itemName: item.name,
          type: "WRITE_OFF",
          quantity,
          fromLocation: item.warehouse,
          toLocation: "Списано",
          performedBy,
          reason: `Списание: ${reason} (${quantity} ${item.unit})`,
        },
      });

      await recordWmsOutboxEvent(tx, {
        eventName: "wms.writeoff.created",
        aggregateType: "WmsItem",
        aggregateId: itemId,
        payload: {
          writeOffId: wo.id,
          itemId,
          sku: item.sku,
          name: item.name,
          quantity,
          reason,
          performedBy,
        },
      });

      return wo;
    });

    logEvent({
      level: "audit",
      module: "WMS",
      action: "WRITEOFF_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        writeOffId: writeOff.id,
        itemId,
        sku: item.sku,
        quantity,
        reason,
      },
    });

    return createSuccessResponse({ success: true, writeOff }, request, 201);
  } catch (err) {
    console.error("Failed to create WMS write-off:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "WRITEOFF_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Не удалось оформить списание",
      undefined,
      500,
      request
    );
  }
}
