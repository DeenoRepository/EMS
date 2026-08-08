import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const equipmentId = searchParams.get("equipmentId");

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: any = { isActive: true };
    if (itemId) where.itemId = itemId;
    if (equipmentId) where.equipmentId = equipmentId;

    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return NextResponse.json({ reservations: [] });
      }
      where.item = {
        warehouse: { in: responsibleWarehouses }
      };
    }

    const reservations = await prisma.wmsReservation.findMany({
      where,
      include: {
        item: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ reservations });
  } catch (err) {
    console.error("Failed to fetch WMS reservations:", err);
    return NextResponse.json({ reservations: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const { itemId, equipmentId, equipmentName, maintenancePlanDate, reservedQuantity, reason } = body;

    if (!itemId || !reservedQuantity) {
      return NextResponse.json(
        { error: "Поля Позиция ТМЦ и Количество обязательны" },
        { status: 400 }
      );
    }

    // Проверка остатка ТМЦ
    const item = await prisma.wmsItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ error: "Позиция ТМЦ не найдена" }, { status: 404 });
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(item.warehouse)) {
      return NextResponse.json(
        { error: `Отказано в доступе. Вы не являетесь МОЛ склада "${item.warehouse}"` },
        { status: 403 }
      );
    }

    const availableQty = item.quantity - item.reservedQuantity;
    if (Number(reservedQuantity) > availableQty) {
      return NextResponse.json(
        { error: `Недостаточно свободного остатка для резерва. Доступно: ${availableQty} ${item.unit}` },
        { status: 400 }
      );
    }

    const reservedBy = session.displayName || session.username;

    // Транзакция: создание резерва и увеличение reservedQuantity у ТМЦ
    const [reservation] = await prisma.$transaction([
      prisma.wmsReservation.create({
        data: {
          itemId,
          equipmentId: equipmentId || null,
          equipmentName: equipmentName || null,
          maintenancePlanDate: maintenancePlanDate ? new Date(maintenancePlanDate) : null,
          reservedQuantity: Number(reservedQuantity),
          reservedBy,
          reason: reason || "Резерв под ППР в ТОИР",
        },
      }),
      prisma.wmsItem.update({
        where: { id: itemId },
        data: {
          reservedQuantity: { increment: Number(reservedQuantity) },
        },
      }),
    ]);

    return NextResponse.json({ reservation, success: true }, { status: 201 });
  } catch (err) {
    console.error("Failed to create WMS reservation:", err);
    return NextResponse.json({ error: "Ошибка при резервировании ТМЦ под ТОИР" }, { status: 500 });
  }
}
