import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";
import { positiveIntSchema, wmsIdSchema } from "@/lib/validations/wms";
import { isValidTransferTransition } from "@/lib/wms/state-machine";
import { WmsTransferStatus } from "@prisma/client";

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
      const idParse = wmsIdSchema.safeParse(requestId);
      if (!idParse.success) {
        return NextResponse.json({ error: "Не указан или некорректен ID заявки" }, { status: 400 });
      }

      const targetStatus: WmsTransferStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

      const transferReq = await prisma.wmsTransferRequest.findUnique({
        where: { id: idParse.data },
        include: { item: true }
      });

      if (!transferReq) {
        return NextResponse.json({ error: "Заявка на перемещение не найдена" }, { status: 404 });
      }

      // SEC-04: Идемпотентность статусов — запрет повторной обработки
      if (!isValidTransferTransition(transferReq.status, targetStatus)) {
        return NextResponse.json(
          {
            error: `Заявка на перемещение уже находится в конечном статусе "${transferReq.status}" (SEC-04)`,
            currentStatus: transferReq.status,
          },
          { status: 409 }
        );
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
        // Атомарный перевод статуса в REJECTED при условии, что текущий статус PENDING
        const updatedCount = await prisma.wmsTransferRequest.updateMany({
          where: { id: idParse.data, status: "PENDING" },
          data: { status: "REJECTED", comment: body.comment || "Отклонено получателем" }
        });

        if (updatedCount.count === 0) {
          return NextResponse.json(
            { error: "Заявка на перемещение уже была обработана другим запросом (SEC-04)" },
            { status: 409 }
          );
        }

        const updated = await prisma.wmsTransferRequest.findUnique({ where: { id: idParse.data } });
        return NextResponse.json({ request: updated, success: true });
      }

      // APPROVE: Перемещение остатка из склада-отправителя на склад-получатель
      // SEC-16: Атомарное списывание у склада-отправителя с проверкой достаточного остатка
      const result = await prisma.$transaction(async (tx) => {
        // 1. Изменяем статус трансфера с PENDING на APPROVED
        const reqUpdate = await tx.wmsTransferRequest.updateMany({
          where: { id: idParse.data, status: "PENDING" },
          data: { status: "APPROVED" }
        });

        if (reqUpdate.count === 0) {
          throw new Error("ALREADY_PROCESSED");
        }

        // 2. Атомарное уменьшение количества на складе-отправителе (SEC-16)
        const itemUpdate = await tx.wmsItem.updateMany({
          where: {
            id: transferReq.itemId,
            quantity: { gte: transferReq.quantity }
          },
          data: {
            quantity: { decrement: transferReq.quantity }
          }
        });

        if (itemUpdate.count === 0) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        // Поиск или создание номенклатуры на целевом складе
        const targetItem = await tx.wmsItem.findFirst({
          where: {
            sku: transferReq.itemSku,
            warehouse: transferReq.toWarehouse
          }
        });

        if (targetItem) {
          await tx.wmsItem.update({
            where: { id: targetItem.id },
            data: {
              quantity: { increment: transferReq.quantity },
              lastIncomingDate: new Date()
            }
          });
        } else {
          await tx.wmsItem.create({
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
          });
        }

        await tx.wmsMovement.create({
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
        });

        return await tx.wmsTransferRequest.findUnique({ where: { id: idParse.data } });
      });

      return NextResponse.json({ request: result, success: true });
    }

    // Сценарий 2: Создание новой заявки на перемещение МОЛ-отправителем
    const qtyParse = positiveIntSchema.safeParse(Number(quantity));
    const itemParse = wmsIdSchema.safeParse(itemId);

    if (!itemParse.success || !qtyParse.success || !toWarehouse) {
      return NextResponse.json(
        {
          error: "Некорректные параметры перемещения ТМЦ (SEC-03)",
          details: {
            itemId: itemParse.success ? undefined : itemParse.error.flatten(),
            quantity: qtyParse.success ? undefined : qtyParse.error.flatten(),
            toWarehouse: toWarehouse ? undefined : "Укажите склад-получатель"
          }
        },
        { status: 400 }
      );
    }

    const item = await prisma.wmsItem.findUnique({ where: { id: itemParse.data } });
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
        quantity: qtyParse.data,
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
  } catch (err: any) {
    if (err.message === "ALREADY_PROCESSED") {
      return NextResponse.json(
        { error: "Заявка на перемещение уже была обработана (SEC-04)" },
        { status: 409 }
      );
    }
    if (err.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        { error: "Недостаточно остатка на складе отправителя (SEC-16)" },
        { status: 409 }
      );
    }
    console.error("WMS Transfer request POST failed:", err);
    return NextResponse.json({ error: "Ошибка обработки межскладского перемещения" }, { status: 500 });
  }
}
