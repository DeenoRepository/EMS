import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { WmsMovementType } from "@prisma/client";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const type = searchParams.get("type");

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: any = {};

    if (itemId) where.itemId = itemId;
    if (type) where.type = type as WmsMovementType;

    // Ограничение движений по складам МОЛ
    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return NextResponse.json({ movements: [], total: 0 });
      }
      where.item = {
        warehouse: { in: responsibleWarehouses }
      };
    }

    const movements = await prisma.wmsMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ movements, total: movements.length });
  } catch (err) {
    console.error("WMS Movements query failed:", err);
    return NextResponse.json({ movements: [], total: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemId, type, quantity, fromLocation, toLocation, performedBy, reason, relatedOrderOrEq } = body;

    if (!itemId || !type || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: "Некорректные параметры движения ТМЦ" },
        { status: 400 }
      );
    }

    const item = await prisma.wmsItem.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return NextResponse.json({ error: "Позиция ТМЦ не найдена" }, { status: 404 });
    }

    // Проверка, является ли оператор МОЛ за склад данной позиции
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(item.warehouse)) {
      return NextResponse.json(
        { error: `Отказано в доступе. Вы не являетесь ответственным за склад "${item.warehouse}"` },
        { status: 403 }
      );
    }

    let newQuantity = item.quantity;
    if (type === "INCOMING") {
      newQuantity += Number(quantity);
    } else if (type === "OUTGOING" || type === "PERSONAL_CARD") {
      if (item.quantity < quantity) {
        return NextResponse.json(
          { error: `Недостаточно остатка на складе. Доступно: ${item.quantity} ${item.unit}` },
          { status: 400 }
        );
      }
      newQuantity -= Number(quantity);
    } else if (type === "ADJUSTMENT") {
      newQuantity = Number(quantity);
    }

    const newStatus = newQuantity <= 0 ? "OUT_OF_STOCK" : newQuantity <= item.minQuantity ? "LOW_STOCK" : "IN_STOCK";

    const [movement] = await prisma.$transaction([
      prisma.wmsMovement.create({
        data: {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          type: type as WmsMovementType,
          quantity: Number(quantity),
          fromLocation: fromLocation || item.cell,
          toLocation: toLocation || null,
          performedBy: performedBy || "Кладовщик",
          reason: reason || null,
          relatedOrderOrEq: relatedOrderOrEq || null,
        }
      }),
      prisma.wmsItem.update({
        where: { id: item.id },
        data: {
          quantity: newQuantity,
          status: newStatus,
          lastIncomingDate: type === "INCOMING" ? new Date() : item.lastIncomingDate,
          lastOutgoingDate: type === "OUTGOING" ? new Date() : item.lastOutgoingDate,
        }
      })
    ]);

    return NextResponse.json({ movement, success: true }, { status: 201 });
  } catch (err) {
    console.error("WMS Movement transaction failed:", err);
    return NextResponse.json({ error: "Ошибка проведения складской операции" }, { status: 500 });
  }
}
