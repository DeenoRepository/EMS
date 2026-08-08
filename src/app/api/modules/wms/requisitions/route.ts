import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { WmsRequisitionStatus } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromWarehouse = searchParams.get("fromWarehouse");
  const toWarehouse = searchParams.get("toWarehouse");
  const status = searchParams.get("status");

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: any = {};
    if (fromWarehouse) where.fromWarehouse = fromWarehouse;
    if (toWarehouse) where.toWarehouse = toWarehouse;
    if (status) where.status = status as WmsRequisitionStatus;

    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return NextResponse.json({ requisitions: [] });
      }
      where.OR = [
        { fromWarehouse: { in: responsibleWarehouses } },
        { toWarehouse: { in: responsibleWarehouses } }
      ];
    }

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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const { fromWarehouse, toWarehouse, note, items } = body;

    if (!fromWarehouse || !toWarehouse || !items || !items.length) {
      return NextResponse.json(
        { error: "Все ключевые поля (Склад-источник, Склад-получатель, Товары) обязательны" },
        { status: 400 }
      );
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(toWarehouse)) {
      return NextResponse.json(
        { error: `Отказано в доступе. Только МОЛ склада-получателя ("${toWarehouse}") может запрашивать СИЗ/ТМЦ.` },
        { status: 403 }
      );
    }

    const requestedBy = session.displayName || session.username;
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "ID и новый статус обязательны" }, { status: 400 });
    }

    const reqItem = await prisma.wmsRequisition.findUnique({ where: { id } });
    if (!reqItem) {
      return NextResponse.json({ error: "Запрос не найден" }, { status: 404 });
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null) {
      const isFromMol = responsibleWarehouses.includes(reqItem.fromWarehouse);
      const isToMol = responsibleWarehouses.includes(reqItem.toWarehouse);
      if (!isFromMol && !isToMol) {
        return NextResponse.json(
          { error: "Отказано в доступе. Вы не являетесь МОЛ склада-отправителя или склада-получателя." },
          { status: 403 }
        );
      }
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
