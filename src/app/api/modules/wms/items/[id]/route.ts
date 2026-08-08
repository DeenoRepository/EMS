import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { WmsItemType, WmsItemStatus } from "@prisma/client";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existingItem = await prisma.wmsItem.findUnique({
      where: { id }
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Номенклатурная единица ТМЦ не найдена" },
        { status: 404 }
      );
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (
      responsibleWarehouses !== null &&
      !responsibleWarehouses.includes(existingItem.warehouse)
    ) {
      return NextResponse.json(
        {
          error: `Отказано в доступе. Вы являетесь ответственным только за склады: ${responsibleWarehouses.join(
            ", "
          )}`
        },
        { status: 403 }
      );
    }

    const targetWarehouse = body.warehouse || existingItem.warehouse;
    if (
      responsibleWarehouses !== null &&
      !responsibleWarehouses.includes(targetWarehouse)
    ) {
      return NextResponse.json(
        {
          error: `Отказано в доступе к целевому складу: ${targetWarehouse}`
        },
        { status: 403 }
      );
    }

    const newQuantity = body.quantity !== undefined ? Number(body.quantity) : existingItem.quantity;
    const minQty = body.minQuantity !== undefined ? Number(body.minQuantity) : existingItem.minQuantity;
    const maxQty = body.maxQuantity !== undefined ? Number(body.maxQuantity) : existingItem.maxQuantity;

    let computedStatus: WmsItemStatus = existingItem.status;
    if (newQuantity <= 0) {
      computedStatus = "OUT_OF_STOCK";
    } else if (newQuantity <= minQty) {
      computedStatus = "LOW_STOCK";
    } else {
      computedStatus = "IN_STOCK";
    }

    const cellChanged = body.cell !== undefined && body.cell !== existingItem.cell;
    const zoneChanged = body.zone !== undefined && body.zone !== existingItem.zone;
    const warehouseChanged = body.warehouse !== undefined && body.warehouse !== existingItem.warehouse;
    const qtyChanged = newQuantity !== existingItem.quantity;

    const updateData: any = {
      name: body.name || existingItem.name,
      sku: body.sku || existingItem.sku,
      category: body.category || existingItem.category,
      type: (body.type as WmsItemType) || existingItem.type,
      unit: body.unit || existingItem.unit,
      warehouse: targetWarehouse,
      zone: body.zone !== undefined ? body.zone : existingItem.zone,
      cell: body.cell !== undefined ? body.cell : existingItem.cell,
      batchNumber: body.batchNumber !== undefined ? body.batchNumber : existingItem.batchNumber,
      serialNumber: body.serialNumber !== undefined ? body.serialNumber : existingItem.serialNumber,
      quantity: newQuantity,
      minQuantity: minQty,
      maxQuantity: maxQty,
      unitPrice: body.unitPrice !== undefined ? Number(body.unitPrice) : existingItem.unitPrice,
      currency: body.currency || existingItem.currency,
      status: computedStatus,
      isEps: body.isEps !== undefined ? Boolean(body.isEps) : existingItem.isEps,
      supplier: body.supplier !== undefined ? body.supplier : existingItem.supplier,
      description: body.description !== undefined ? body.description : existingItem.description,
      barcode: body.barcode !== undefined ? body.barcode : existingItem.barcode,
      updatedAt: new Date()
    };

    if (cellChanged || zoneChanged || warehouseChanged || qtyChanged) {
      const locationFrom = `${existingItem.warehouse} / ${existingItem.zone || ""}-${existingItem.cell || ""}`;
      const locationTo = `${targetWarehouse} / ${updateData.zone || ""}-${updateData.cell || ""}`;
      
      const [updatedItem] = await prisma.$transaction([
        prisma.wmsItem.update({
          where: { id },
          data: updateData
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
            performedBy: "Кладовщик",
            reason: `Корректировка позиции ТМЦ / Ячейки хранения (${locationFrom} -> ${locationTo})`
          }
        })
      ]);

      return NextResponse.json({ item: updatedItem, success: true });
    } else {
      const updatedItem = await prisma.wmsItem.update({
        where: { id },
        data: updateData
      });

      return NextResponse.json({ item: updatedItem, success: true });
    }
  } catch (err: any) {
    console.error("Failed to update WMS item:", err);
    return NextResponse.json(
      { error: "Не удалось обновить позицию ТМЦ" },
      { status: 500 }
    );
  }
}
