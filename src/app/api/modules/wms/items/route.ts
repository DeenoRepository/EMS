import { prisma } from "@/lib/db/prisma";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";
import { createWmsItemSchema } from "@/lib/validations/wms";
import { recordWmsOutboxEvent } from "@/lib/wms/outbox-processor";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const wmsItemsQuerySchema = z.object({
  query: z.string().optional(),
  warehouse: z.string().optional(),
  warehouseId: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/modules/wms/items
 *
 * Получить список ТМЦ с фильтрацией по складу, категории и поисковому запросу.
 * Применяется scope-based фильтрация по ответственным складам пользователя.
 *
 * @requires Permission: wms.items.read
 * @returns {Promise<{ items: WmsItem[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = wmsItemsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { query, warehouse, warehouseId, category, status, limit, offset } = parseResult.data;

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: Record<string, unknown> = {};

    // SEC-09: Scope-based фильтрация по складам МОЛ
    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return createSuccessResponse({ items: [], total: 0, limit, offset }, request);
      }
      where.OR = [
        { warehouse: { in: responsibleWarehouses } },
        { warehouseId: { in: responsibleWarehouses } },
      ];
    }

    if (query) {
      where.AND = [
        ...((where.AND as unknown[]) || []),
        {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
            { batchNumber: { contains: query, mode: "insensitive" } },
            { serialNumber: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
            { cell: { contains: query, mode: "insensitive" } },
          ],
        },
      ];
    }
    if (warehouseId) {
      where.warehouseId = warehouseId;
    } else if (warehouse) {
      if (responsibleWarehouses !== null && !responsibleWarehouses.includes(warehouse)) {
        return createSuccessResponse({ items: [], total: 0, limit, offset }, request);
      }
      where.warehouse = warehouse;
    }
    if (category) where.category = category;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.wmsItem.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          warehouseRef: { select: { id: true, name: true, code: true } },
          zoneRef: { select: { id: true, name: true, code: true } },
          cellRef: { select: { id: true, code: true } },
          equipment: { select: { id: true, name: true, equipmentCode: true } },
        },
      }),
      prisma.wmsItem.count({ where }),
    ]);

    return createSuccessResponse({ items, total, limit, offset }, request);
  } catch (err) {
    console.error("WMS Items query failed:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "ITEMS_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка ТМЦ",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/wms/items
 *
 * Приход номенклатурной единицы (создание или пополнение существующей).
 * Публикует доменное событие через Transactional Outbox.
 *
 * @requires Permission: wms.items.create
 * @returns {Promise<{ success: true, item: WmsItem, isExisting: boolean }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    const rawBody = await request.json();
    const parseResult = createWmsItemSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные параметры запроса ТМЦ (SEC-03)",
        parseResult.error.flatten(),
        400,
        request
      );
    }

    const body = parseResult.data;

    // SEC-09: Проверка прав на склад
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(body.warehouse)) {
      logEvent({
        level: "warn",
        module: "WMS",
        action: "ITEM_CREATE_DENIED_SCOPE",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { warehouse: body.warehouse, allowed: responsibleWarehouses },
      });
      return createErrorResponse(
        "FORBIDDEN",
        `Отказано в доступе. Вы являетесь ответственным только за склады: ${responsibleWarehouses.join(", ")}`,
        undefined,
        403,
        request
      );
    }

    const incomingQty = body.quantity || 1;
    const sessionUser = session.displayName || session.username;

    // Поиск объекта склада для получения warehouseId
    const targetWarehouseObj = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { name: body.warehouse },
          { id: rawBody.warehouseId || "" },
        ],
      },
    });

    const targetWarehouseId = targetWarehouseObj?.id || rawBody.warehouseId || null;

    // 1. Поиск существующей номенклатурной единицы по артикулу (SKU) на выбранном складе
    const existingNomenclature = await prisma.wmsItem.findFirst({
      where: {
        sku: body.sku,
        OR: [
          { warehouse: body.warehouse },
          ...(targetWarehouseId ? [{ warehouseId: targetWarehouseId }] : []),
        ],
      },
    });

    if (existingNomenclature) {
      const updatedQty = existingNomenclature.quantity + incomingQty;
      const updatedStatus =
        updatedQty <= 0
          ? "OUT_OF_STOCK"
          : updatedQty <= existingNomenclature.minQuantity
            ? "LOW_STOCK"
            : "IN_STOCK";

      const updatedItem = await prisma.$transaction(async (tx) => {
        const item = await tx.wmsItem.update({
          where: { id: existingNomenclature.id },
          data: {
            quantity: updatedQty,
            unitPrice: body.unitPrice ?? existingNomenclature.unitPrice,
            cell: body.cell || existingNomenclature.cell,
            warehouseId: targetWarehouseId || existingNomenclature.warehouseId,
            equipmentId: rawBody.equipmentId || existingNomenclature.equipmentId,
            status: updatedStatus,
            updatedAt: new Date(),
          },
        });

        const movement = await tx.wmsMovement.create({
          data: {
            itemId: existingNomenclature.id,
            itemSku: existingNomenclature.sku,
            itemName: existingNomenclature.name,
            type: "INCOMING",
            quantity: incomingQty,
            fromLocation: "Поставщик / Приход",
            toLocation: body.cell || existingNomenclature.cell || "Склад",
            performedBy: sessionUser,
            reason: `Приход номенклатурной единицы (${incomingQty} ${existingNomenclature.unit})`,
          },
        });

        await recordWmsOutboxEvent(tx, {
          eventName: "wms.stock.received",
          aggregateType: "WmsItem",
          aggregateId: item.id,
          payload: {
            itemId: item.id,
            sku: item.sku,
            quantity: incomingQty,
            totalQuantity: updatedQty,
            movementId: movement.id,
            performedBy: sessionUser,
          },
        });

        return item;
      });

      logEvent({
        level: "audit",
        module: "WMS",
        action: "ITEM_STOCK_RECEIVED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: {
          itemId: updatedItem.id,
          sku: updatedItem.sku,
          quantity: incomingQty,
          totalQuantity: updatedQty,
        },
      });

      return createSuccessResponse(
        { success: true, item: updatedItem, isExisting: true },
        request,
        200
      );
    }

    // 2. Создание новой номенклатурной единицы в каталоге
    const newItem = await prisma.$transaction(async (tx) => {
      const item = await tx.wmsItem.create({
        data: {
          sku: body.sku,
          name: body.name,
          category: body.category,
          type: body.type,
          unit: body.unit,
          warehouse: body.warehouse,
          cell: body.cell || "Яч-01",
          warehouseId: targetWarehouseId,
          equipmentId: rawBody.equipmentId || null,
          batchNumber: body.batchNumber || null,
          serialNumber: body.serialNumber || null,
          quantity: incomingQty,
          minQuantity: body.minQuantity,
          maxQuantity: body.maxQuantity,
          unitPrice: body.unitPrice,
          currency: body.currency,
          status: incomingQty <= body.minQuantity ? "LOW_STOCK" : "IN_STOCK",
          supplier: body.supplier || "Поставщик",
          description: body.description || null,
        },
      });

      const movement = await tx.wmsMovement.create({
        data: {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          type: "INCOMING",
          quantity: incomingQty,
          fromLocation: "Поставщик / Новая номенклатура",
          toLocation: body.cell || "Яч-01",
          performedBy: sessionUser,
          reason: `Первичный приход новой номенклатурной единицы (${incomingQty} ${body.unit})`,
        },
      });

      await recordWmsOutboxEvent(tx, {
        eventName: "wms.item.created",
        aggregateType: "WmsItem",
        aggregateId: item.id,
        payload: {
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          warehouse: item.warehouse,
          warehouseId: targetWarehouseId,
          quantity: incomingQty,
          movementId: movement.id,
          performedBy: sessionUser,
        },
      });

      return item;
    });

    logEvent({
      level: "audit",
      module: "WMS",
      action: "ITEM_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        itemId: newItem.id,
        sku: newItem.sku,
        warehouse: newItem.warehouse,
        quantity: incomingQty,
      },
    });

    return createSuccessResponse(
      { success: true, item: newItem, isExisting: false },
      request,
      201
    );
  } catch (err) {
    console.error("Failed to process WMS item receiving:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "ITEM_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Не удалось провести приход номенклатурной единицы",
      undefined,
      500,
      request
    );
  }
}
