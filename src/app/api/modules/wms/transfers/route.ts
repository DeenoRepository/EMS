import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const session = await getSession();
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: any = {};

    if (status) where.status = status;

    // Если пользователь МОЛ, показываем заявки где он отправитель ИЛИ получатель
    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return NextResponse.json({ requests: [], total: 0 });
      }
      where.OR = [
        { fromWarehouse: { in: responsibleWarehouses } },
        { toWarehouse: { in: responsibleWarehouses } }
      ];
    }

    const requests = await prisma.wmsTransferRequest.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ requests, total: requests.length });
  } catch (err) {
    console.error("WMS Transfer requests GET failed:", err);
    return NextResponse.json({ requests: [], total: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const { action, requestId, itemId, quantity, toWarehouse, reason } = body;

    // Сценарий 1: Подтверждение / Отклонение заявки (Приемка МОЛ-получателем)
    if (action === "APPROVE" || action === "REJECT") {
      if (!requestId) {
        return NextResponse.json({ error: "Не указан ID заявки" }, { status: 400 });
      }

      const transferReq = await prisma.wmsTransferRequest.findUnique({
        where: { id: requestId },
        include: { item: true }
      });

      if (!transferReq) {
        return NextResponse.json({ error: "Заявка на перемещение не найдена" }, { status: 404 });
      }

      // Проверка прав МОЛ целевого склада
      const responsibleWarehouses = await getUserResponsibleWarehouses();
      if (responsibleWarehouses !== null && !responsibleWarehouses.includes(transferReq.toWarehouse)) {
        return NextResponse.json(
          { error: `Отказано в доступе. Только МОЛ склада "${transferReq.toWarehouse}" может подтвердить прием.` },
          { status: 403 }
        );
      }

      if (action === "REJECT") {
        const updated = await prisma.wmsTransferRequest.update({
          where: { id: requestId },
          data: { status: "REJECTED", comment: body.comment || "Отклонено получателем" }
        });
        return NextResponse.json({ request: updated, success: true });
      }

      // APPROVE: Перемещение остатка из склада-отправителя на склад-получатель
      if (transferReq.item.quantity < transferReq.quantity) {
        return NextResponse.json(
          { error: `Недостаточно остатка на складе отправителя. Доступно: ${transferReq.item.quantity}` },
          { status: 400 }
        );
      }

      // Проверка наличия такой же номенклатуры на складе-получателе
      const targetItem = await prisma.wmsItem.findFirst({
        where: {
          sku: transferReq.itemSku,
          warehouse: transferReq.toWarehouse
        }
      });

      const txOps: any[] = [
        prisma.wmsTransferRequest.update({
          where: { id: requestId },
          data: { status: "APPROVED" }
        }),
        prisma.wmsItem.update({
          where: { id: transferReq.itemId },
          data: {
            quantity: transferReq.item.quantity - transferReq.quantity,
            status: (transferReq.item.quantity - transferReq.quantity) <= 0 ? "OUT_OF_STOCK" : (transferReq.item.quantity - transferReq.quantity) <= transferReq.item.minQuantity ? "LOW_STOCK" : "IN_STOCK"
          }
        }),
        prisma.wmsMovement.create({
          data: {
            itemId: transferReq.itemId,
            itemSku: transferReq.itemSku,
            itemName: transferReq.itemName,
            type: "TRANSFER",
            quantity: transferReq.quantity,
            fromLocation: transferReq.fromWarehouse,
            toLocation: transferReq.toWarehouse,
            performedBy: session.displayName || session.username,
            reason: `Межскладской трансфер (Заявка ${transferReq.id.slice(-6)})`,
          }
        })
      ];

      if (targetItem) {
        // Увеличиваем остаток у существующей номенклатурной единицы на целевом складе
        const newTargetQty = targetItem.quantity + transferReq.quantity;
        txOps.push(
          prisma.wmsItem.update({
            where: { id: targetItem.id },
            data: {
              quantity: newTargetQty,
              status: newTargetQty <= 0 ? "OUT_OF_STOCK" : newTargetQty <= targetItem.minQuantity ? "LOW_STOCK" : "IN_STOCK",
              lastIncomingDate: new Date()
            }
          })
        );
      } else {
        // Создаем новую номенклатурную позицию на целевом складе
        txOps.push(
          prisma.wmsItem.create({
            data: {
              sku: transferReq.item.sku,
              name: transferReq.item.name,
              category: transferReq.item.category,
              type: transferReq.item.type,
              unit: transferReq.item.unit,
              warehouse: transferReq.toWarehouse,
              cell: "Приёмка",
              quantity: transferReq.quantity,
              minQuantity: transferReq.item.minQuantity,
              maxQuantity: transferReq.item.maxQuantity,
              unitPrice: transferReq.item.unitPrice,
              currency: transferReq.item.currency,
              status: transferReq.quantity <= transferReq.item.minQuantity ? "LOW_STOCK" : "IN_STOCK",
              supplier: transferReq.item.supplier,
              description: transferReq.item.description,
              lastIncomingDate: new Date()
            }
          })
        );
      }

      const [updated] = await prisma.$transaction(txOps);

      return NextResponse.json({ request: updated, success: true });
    }

    // Сценарий 2: Создание новой заявки на перемещение МОЛ-отправителем
    if (!itemId || !quantity || !toWarehouse) {
      return NextResponse.json(
        { error: "Поля Позиция ТМЦ, Количество и Склад-получатель обязательны" },
        { status: 400 }
      );
    }

    const item = await prisma.wmsItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ error: "Позиция ТМЦ не найдена" }, { status: 404 });
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(item.warehouse)) {
      return NextResponse.json(
        { error: `Вы не являетесь МОЛ склада "${item.warehouse}" для отправки заявки.` },
        { status: 403 }
      );
    }

    const created = await prisma.wmsTransferRequest.create({
      data: {
        itemId: item.id,
        itemSku: item.sku,
        itemName: item.name,
        quantity: Number(quantity),
        fromWarehouse: item.warehouse,
        toWarehouse: toWarehouse,
        requestedBy: session.displayName || session.username,
        requestedByUsername: session.username,
        targetMolUser: body.targetMolUser || "МОЛ " + toWarehouse,
        reason: reason || "Межскладская потребность",
        status: "PENDING"
      }
    });

    return NextResponse.json({ request: created, success: true }, { status: 201 });
  } catch (err) {
    console.error("WMS Transfer request POST failed:", err);
    return NextResponse.json({ error: "Ошибка обработки межскладского перемещения" }, { status: 500 });
  }
}
