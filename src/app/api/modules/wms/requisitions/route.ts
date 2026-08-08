import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { WmsRequisitionStatus } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromWarehouse = searchParams.get("fromWarehouse");
  const toWarehouse = searchParams.get("toWarehouse");
  const status = searchParams.get("status");

  try {
    const where: any = {};
    if (fromWarehouse) where.fromWarehouse = fromWarehouse;
    if (toWarehouse) where.toWarehouse = toWarehouse;
    if (status) where.status = status as WmsRequisitionStatus;

    const requisitions = await prisma.wmsRequisition.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requisitions });
  } catch (err) {
    console.error("Failed to fetch WMS requisitions:", err);
    return NextResponse.json({ requisitions: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fromWarehouse, toWarehouse, requestedBy, note, items } = body;

    if (!fromWarehouse || !toWarehouse || !requestedBy || !items || !items.length) {
      return NextResponse.json(
        { error: "Все ключевые поля (Склад-источник, Склад-получатель, Запросивший, Товары) обязательны" },
        { status: 400 }
      );
    }

    const requisitionNumber = `REQ-${Date.now().toString().slice(-6)}`;

    const requisition = await prisma.wmsRequisition.create({
      data: {
        requisitionNumber,
        fromWarehouse,
        toWarehouse,
        requestedBy,
        note: note || null,
        status: "REQUESTED",
        items: {
          create: items.map((item: any) => ({
            itemId: item.itemId,
            itemSku: item.itemSku,
            itemName: item.itemName,
            quantity: Number(item.quantity) || 1,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({ requisition, success: true }, { status: 201 });
  } catch (err) {
    console.error("Failed to create WMS requisition:", err);
    return NextResponse.json({ error: "Ошибка при создании межскладского запроса" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "ID и новый статус обязательны" }, { status: 400 });
    }

    const updated = await prisma.wmsRequisition.update({
      where: { id },
      data: { status: status as WmsRequisitionStatus },
      include: { items: true },
    });

    return NextResponse.json({ requisition: updated, success: true });
  } catch (err) {
    console.error("Failed to update WMS requisition:", err);
    return NextResponse.json({ error: "Ошибка при обновлении статуса запроса" }, { status: 500 });
  }
}
