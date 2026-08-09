import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { WmsWriteOffReason } from "@prisma/client";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";
import { createWriteOffSchema } from "@/lib/validations/wms";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const reason = searchParams.get("reason");

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: any = {};
    if (itemId) where.itemId = itemId;
    if (reason) where.reason = reason as WmsWriteOffReason;

    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return NextResponse.json({ writeOffs: [] });
      }
      where.item = {
        warehouse: { in: responsibleWarehouses }
      };
    }

    const writeOffs = await prisma.wmsWriteOff.findMany({
      where,
      include: {
        item: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ writeOffs });
  } catch (err) {
    console.error("Failed to fetch WMS write-offs:", err);
    return NextResponse.json({ writeOffs: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const rawBody = await request.json();
    const parseResult = createWriteOffSchema.safeParse({
      itemId: rawBody.itemId,
      quantity: Number(rawBody.quantity),
      reason: rawBody.reason || "EQUIPMENT_REPAIR",
      approvedBy: session.displayName || session.username,
      equipmentId: rawBody.equipmentId,
      notes: rawBody.comments,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Некорректные параметры списания ТМЦ (SEC-03)",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { itemId, quantity, reason } = parseResult.data;
    const { equipmentId, equipmentName, comments } = rawBody;

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

    const availableQuantity = item.quantity - item.reservedQuantity;
    if (quantity > availableQuantity) {
      return NextResponse.json(
        { error: `Нельзя списать больше доступного остатка (с учетом резерва). Доступно к списанию: ${availableQuantity} ${item.unit} (Всего: ${item.quantity}, Зарезервировано: ${item.reservedQuantity})` },
        { status: 400 }
      );
    }

    const performedBy = session.displayName || session.username;
    const newQty = item.quantity - quantity;
    const newStatus = newQty <= item.minQuantity ? (newQty === 0 ? "OUT_OF_STOCK" : "LOW_STOCK") : "IN_STOCK";

    // Транзакция: списание ТМЦ и запись движения
    const [writeOff] = await prisma.$transaction([
      prisma.wmsWriteOff.create({
        data: {
          itemId,
          itemSku: item.sku,
          itemName: item.name,
          quantity,
          reason,
          equipmentId: equipmentId || null,
          equipmentName: equipmentName || null,
          performedBy,
          comments: comments || null,
        },
      }),
      prisma.wmsItem.update({
        where: { id: itemId },
        data: {
          quantity: newQty,
          status: newStatus,
          lastOutgoingDate: new Date(),
        },
      }),
      prisma.wmsMovement.create({
        data: {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          type: "OUTGOING",
          quantity,
          fromLocation: `${item.warehouse} (${item.cell || "Обустройство"})`,
          performedBy,
          reason: `Списание: ${reason} ${equipmentName ? `(${equipmentName})` : ""}`,
          relatedOrderOrEq: equipmentId || null,
        },
      }),
    ]);

    return NextResponse.json({ writeOff, success: true }, { status: 201 });
  } catch (err) {
    console.error("Failed to execute WMS write-off:", err);
    return NextResponse.json({ error: "Ошибка при списании ТМЦ" }, { status: 500 });
  }
}
