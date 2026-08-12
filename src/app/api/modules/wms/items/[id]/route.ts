import { prisma } from "@/lib/db/prisma";
import { WmsItemType, WmsItemStatus } from "@prisma/client";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";
import { logEvent } from "@/lib/telemetry/logger";
import { ShellEventBus } from "@/lib/shell/event-bus";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const updateItemSchema = z.object({
  name: z.string().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  type: z.string().optional(),
  unit: z.string().optional(),
  warehouse: z.string().optional(),
  zone: z.string().optional(),
  cell: z.string().optional(),
  batchNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  quantity: z.coerce.number().int().optional(),
  minQuantity: z.coerce.number().int().optional(),
  maxQuantity: z.coerce.number().int().optional(),
  unitPrice: z.coerce.number().optional(),
  currency: z.string().optional(),
  isEps: z.boolean().optional(),
  supplier: z.string().optional(),
  description: z.string().optional(),
  barcode: z.string().optional(),
});

/**
 * PUT /api/modules/wms/items/[id]
 *
 * Обновить номенклатурную единицу ТМЦ с проверкой scope.
 * Публикует доменное событие `wms.stock.adjusted` при изменении количества/ячейки.
 *
 * @requires Permission: wms.items.update
 * @returns {Promise<{ success: true, item: WmsItem }>}
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    const { id } = await context.params;

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

    const validation = updateItemSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные параметры обновления ТМЦ",
        validation.error.flatten(),
        400,
        request
      );
    }

    const existingItem = await prisma.wmsItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return createErrorResponse(
        "NOT_FOUND",
        "Номенклатурная единица ТМЦ не найдена",
        undefined,
        404,
        request
      );
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (
      responsibleWarehouses !== null &&
      !responsibleWarehouses.includes(existingItem.warehouse)
    ) {
      logEvent({
        level: "warn",
        module: "WMS",
        action: "ITEM_UPDATE_DENIED_SCOPE",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { warehouse: existingItem.warehouse, allowed: responsibleWarehouses },
      });
      return createErrorResponse(
        "FORBIDDEN",
        `Отказано в доступе. Вы являетесь ответственным только за склады: ${responsibleWarehouses.join(", ")}`,
        undefined,
        403,
        request
      );
    }

    const targetWarehouse = validation.data.warehouse || existingItem.warehouse;
    if (
      responsibleWarehouses !== null &&
      !responsibleWarehouses.includes(targetWarehouse)
    ) {
      return createErrorResponse(
        "FORBIDDEN",
        `Отказано в доступе к целевому складу: ${targetWarehouse}`,
        undefined,
        403,
        request
      );
    }

    const newQuantity =
      validation.data.quantity !== undefined ? validation.data.quantity : existingItem.quantity;
    const minQty =
      validation.data.minQuantity !== undefined ? validation.data.minQuantity : existingItem.minQuantity;
    const maxQty =
      validation.data.maxQuantity !== undefined ? validation.data.maxQuantity : existingItem.maxQuantity;

    let computedStatus: WmsItemStatus = existingItem.status;
    if (newQuantity <= 0) {
      computedStatus = "OUT_OF_STOCK";
    } else if (newQuantity <= minQty) {
      computedStatus = "LOW_STOCK";
    } else {
      computedStatus = "IN_STOCK";
    }

    const cellChanged =
      validation.data.cell !== undefined && validation.data.cell !== existingItem.cell;
    const zoneChanged =
      validation.data.zone !== undefined && validation.data.zone !== existingItem.zone;
    const warehouseChanged =
      validation.data.warehouse !== undefined && validation.data.warehouse !== existingItem.warehouse;
    const qtyChanged = newQuantity !== existingItem.quantity;

    const updateData = {
      name: validation.data.name || existingItem.name,
      sku: validation.data.sku || existingItem.sku,
      category: validation.data.category || existingItem.category,
      type: (validation.data.type as WmsItemType) || existingItem.type,
      unit: validation.data.unit || existingItem.unit,
      warehouse: targetWarehouse,
      zone: validation.data.zone !== undefined ? validation.data.zone : existingItem.zone,
      cell: validation.data.cell !== undefined ? validation.data.cell : existingItem.cell,
      batchNumber:
        validation.data.batchNumber !== undefined ? validation.data.batchNumber : existingItem.batchNumber,
      serialNumber:
        validation.data.serialNumber !== undefined
          ? validation.data.serialNumber
          : existingItem.serialNumber,
      quantity: newQuantity,
      minQuantity: minQty,
      maxQuantity: maxQty,
      unitPrice:
        validation.data.unitPrice !== undefined ? validation.data.unitPrice : existingItem.unitPrice,
      currency: validation.data.currency || existingItem.currency,
      status: computedStatus,
      isEps: validation.data.isEps !== undefined ? validation.data.isEps : existingItem.isEps,
      supplier:
        validation.data.supplier !== undefined ? validation.data.supplier : existingItem.supplier,
      description:
        validation.data.description !== undefined
          ? validation.data.description
          : existingItem.description,
      barcode: validation.data.barcode !== undefined ? validation.data.barcode : existingItem.barcode,
      updatedAt: new Date(),
    };

    if (cellChanged || zoneChanged || warehouseChanged || qtyChanged) {
      const locationFrom = `${existingItem.warehouse} / ${existingItem.zone || ""}-${existingItem.cell || ""}`;
      const locationTo = `${targetWarehouse} / ${updateData.zone || ""}-${updateData.cell || ""}`;

      const [updatedItem] = await prisma.$transaction([
        prisma.wmsItem.update({
          where: { id },
          data: updateData,
        }),
        prisma.wmsMovement.create({
          data: {
            itemId: existingItem.id,
            itemSku: updateData.sku,
            itemName: updateData.name,
            type: "ADJUSTMENT",
            quantity: newQuantity - existingItem.quantity,
            fromLocation: locationFrom,
            toLocation: locationTo,
            performedBy: session.displayName || session.username,
            reason: `Корректировка позиции ТМЦ / Ячейки хранения (${locationFrom} -> ${locationTo})`,
          },
        }),
      ]);

      logEvent({
        level: "audit",
        module: "WMS",
        action: "ITEM_UPDATED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: {
          itemId: updatedItem.id,
          sku: updatedItem.sku,
          qtyChanged,
          locationChanged: cellChanged || zoneChanged || warehouseChanged,
        },
      });

      await ShellEventBus.publish(
        "wms.stock.adjusted",
        "WMS",
        {
          itemId: updatedItem.id,
          sku: updatedItem.sku,
          name: updatedItem.name,
          newQuantity: updatedItem.quantity,
          performedBy: session.id,
          performedByEmail: session.email,
        },
        correlationId
      );

      return createSuccessResponse({ success: true, item: updatedItem }, request);
    }

    const updatedItem = await prisma.wmsItem.update({
      where: { id },
      data: updateData,
    });

    logEvent({
      level: "audit",
      module: "WMS",
      action: "ITEM_UPDATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { itemId: updatedItem.id, sku: updatedItem.sku },
    });

    return createSuccessResponse({ success: true, item: updatedItem }, request);
  } catch (err) {
    console.error("Failed to update WMS item:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "ITEM_UPDATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Не удалось обновить позицию ТМЦ",
      undefined,
      500,
      request
    );
  }
}
