import { prisma } from "@/lib/db/prisma";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";
import { positiveIntSchema, wmsIdSchema } from "@/lib/validations/wms";
import { isValidTransferTransition } from "@/lib/wms/state-machine";
import { WmsTransferStatus } from "@prisma/client";
import { recordWmsOutboxEvent } from "@/lib/wms/outbox-processor";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const transfersQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createTransferSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  toWarehouse: z.string().min(1, "Укажите склад-получатель"),
  reason: z.string().optional(),
  targetMolUser: z.string().optional(),
});

const decideTransferSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  requestId: z.string().min(1),
  comment: z.string().optional(),
});

/**
 * GET /api/modules/wms/transfers
 *
 * Получить список заявок на межскладское перемещение.
 * Применяется scope-based фильтрация по ответственным складам.
 *
 * @requires Permission: wms.transfers.manage
 * @returns {Promise<{ requests: WmsTransferRequest[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = transfersQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { status, limit, offset } = parseResult.data;

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: Record<string, unknown> = {};

    if (status) where.status = status;

    // Если пользователь МОЛ, показываем заявки где он отправитель ИЛИ получатель
    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return createSuccessResponse({ requests: [], total: 0, limit, offset }, request);
      }
      where.OR = [
        { fromWarehouse: { in: responsibleWarehouses } },
        { toWarehouse: { in: responsibleWarehouses } },
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.wmsTransferRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.wmsTransferRequest.count({ where }),
    ]);

    return createSuccessResponse({ requests, total, limit, offset }, request);
  } catch (err) {
    console.error("WMS Transfer requests GET failed:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "TRANSFERS_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка заявок на перемещение",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/wms/transfers
 *
 * Создать новую заявку на перемещение или принять решение по существующей (APPROVE/REJECT).
 * Публикует доменные события через Transactional Outbox.
 *
 * @requires Permission: wms.transfers.manage
 * @returns {Promise<{ success: true, request: WmsTransferRequest }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

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

    const sessionUser = session.displayName || session.username;
    const bodyObj = body as Record<string, unknown>;

    // Сценарий 1: Подтверждение / Отклонение заявки (Приемка МОЛ-получателем)
    if (bodyObj.action === "APPROVE" || bodyObj.action === "REJECT") {
      const decideParse = decideTransferSchema.safeParse(bodyObj);
      if (!decideParse.success) {
        return createErrorResponse(
          "VALIDATION_ERROR",
          "Не указан или некорректен ID заявки",
          decideParse.error.flatten(),
          400,
          request
        );
      }

      const { action, requestId, comment } = decideParse.data;
      const targetStatus: WmsTransferStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

      const transferReq = await prisma.wmsTransferRequest.findUnique({
        where: { id: requestId },
        include: { item: true },
      });

      if (!transferReq) {
        return createErrorResponse(
          "NOT_FOUND",
          "Заявка на перемещение не найдена",
          undefined,
          404,
          request
        );
      }

      // SEC-04: Идемпотентность статусов — запрет повторной обработки
      if (!isValidTransferTransition(transferReq.status, targetStatus)) {
        return createErrorResponse(
          "CONFLICT",
          `Заявка на перемещение уже находится в конечном статусе "${transferReq.status}" (SEC-04)`,
          { currentStatus: transferReq.status },
          409,
          request
        );
      }

      // Проверка прав МОЛ целевого склада
      const responsibleWarehouses = await getUserResponsibleWarehouses();
      if (responsibleWarehouses !== null && !responsibleWarehouses.includes(transferReq.toWarehouse)) {
        logEvent({
          level: "warn",
          module: "WMS",
          action: "TRANSFER_DECIDE_DENIED_SCOPE",
          userId: session.id,
          userEmail: session.email,
          requestId: correlationId,
          details: { toWarehouse: transferReq.toWarehouse, allowed: responsibleWarehouses },
        });
        return createErrorResponse(
          "FORBIDDEN",
          `Отказано в доступе. Только МОЛ склада "${transferReq.toWarehouse}" может подтвердить прием.`,
          undefined,
          403,
          request
        );
      }

      if (action === "REJECT") {
        const updatedReq = await prisma.$transaction(async (tx) => {
          const updatedCount = await tx.wmsTransferRequest.updateMany({
            where: { id: requestId, status: "PENDING" },
            data: { status: "REJECTED", comment: comment || "Отклонено получателем" },
          });

          if (updatedCount.count === 0) {
            throw new Error("ALREADY_PROCESSED");
          }

          await recordWmsOutboxEvent(tx, {
            eventName: "wms.transfer.rejected",
            aggregateType: "WmsTransferRequest",
            aggregateId: requestId,
            payload: {
              requestId,
              fromWarehouse: transferReq.fromWarehouse,
              toWarehouse: transferReq.toWarehouse,
              performedBy: sessionUser,
              comment: comment || "Отклонено получателем",
            },
          });

          return await tx.wmsTransferRequest.findUnique({ where: { id: requestId } });
        });

        logEvent({
          level: "audit",
          module: "WMS",
          action: "TRANSFER_REJECTED",
          userId: session.id,
          userEmail: session.email,
          requestId: correlationId,
          details: { requestId, fromWarehouse: transferReq.fromWarehouse, toWarehouse: transferReq.toWarehouse },
        });

        return createSuccessResponse({ success: true, request: updatedReq }, request);
      }

      // APPROVE: Перемещение остатка из склада-отправителя на склад-получатель
      const result = await prisma.$transaction(async (tx) => {
        // 1. Изменяем статус трансфера с PENDING на APPROVED
        const reqUpdate = await tx.wmsTransferRequest.updateMany({
          where: { id: requestId, status: "PENDING" },
          data: { status: "APPROVED" },
        });

        if (reqUpdate.count === 0) {
          throw new Error("ALREADY_PROCESSED");
        }

        // 2. Атомарное уменьшение количества на складе-отправителе (SEC-16)
        const itemUpdate = await tx.wmsItem.updateMany({
          where: {
            id: transferReq.itemId,
            quantity: { gte: transferReq.quantity },
          },
          data: {
            quantity: { decrement: transferReq.quantity },
          },
        });

        if (itemUpdate.count === 0) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        // Поиск или создание номенклатуры на целевом складе
        const targetItem = await tx.wmsItem.findFirst({
          where: {
            sku: transferReq.itemSku,
            warehouse: transferReq.toWarehouse,
          },
        });

        if (targetItem) {
          await tx.wmsItem.update({
            where: { id: targetItem.id },
            data: {
              quantity: { increment: transferReq.quantity },
              lastIncomingDate: new Date(),
            },
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
              lastIncomingDate: new Date(),
            },
          });
        }

        const movement = await tx.wmsMovement.create({
          data: {
            itemId: transferReq.itemId,
            itemSku: transferReq.itemSku,
            itemName: transferReq.itemName,
            type: "TRANSFER",
            quantity: transferReq.quantity,
            fromLocation: transferReq.fromWarehouse,
            toLocation: transferReq.toWarehouse,
            performedBy: sessionUser,
            reason: `Межскладской трансфер (Заявка ${transferReq.id.slice(-6)})`,
          },
        });

        await recordWmsOutboxEvent(tx, {
          eventName: "wms.transfer.approved",
          aggregateType: "WmsTransferRequest",
          aggregateId: requestId,
          payload: {
            requestId,
            itemId: transferReq.itemId,
            quantity: transferReq.quantity,
            fromWarehouse: transferReq.fromWarehouse,
            toWarehouse: transferReq.toWarehouse,
            movementId: movement.id,
            performedBy: sessionUser,
          },
        });

        return await tx.wmsTransferRequest.findUnique({ where: { id: requestId } });
      });

      logEvent({
        level: "audit",
        module: "WMS",
        action: "TRANSFER_APPROVED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { requestId, fromWarehouse: transferReq.fromWarehouse, toWarehouse: transferReq.toWarehouse },
      });

      return createSuccessResponse({ success: true, request: result }, request);
    }

    // Сценарий 2: Создание новой заявки на перемещение МОЛ-отправителем
    const createParse = createTransferSchema.safeParse(bodyObj);
    if (!createParse.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные параметры перемещения ТМЦ (SEC-03)",
        createParse.error.flatten(),
        400,
        request
      );
    }

    const { itemId, quantity, toWarehouse, reason, targetMolUser } = createParse.data;

    const item = await prisma.wmsItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return createErrorResponse(
        "NOT_FOUND",
        "Позиция ТМЦ не найдена",
        undefined,
        404,
        request
      );
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(item.warehouse)) {
      logEvent({
        level: "warn",
        module: "WMS",
        action: "TRANSFER_CREATE_DENIED_SCOPE",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { warehouse: item.warehouse, allowed: responsibleWarehouses },
      });
      return createErrorResponse(
        "FORBIDDEN",
        `Вы не являетесь МОЛ склада "${item.warehouse}" для отправки заявки.`,
        undefined,
        403,
        request
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const req = await tx.wmsTransferRequest.create({
        data: {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          quantity,
          fromWarehouse: item.warehouse,
          toWarehouse,
          requestedBy: sessionUser,
          requestedByUsername: session.username,
          targetMolUser: targetMolUser || `МОЛ ${toWarehouse}`,
          reason: reason || "Межскладская потребность",
          status: "PENDING",
        },
      });

      await recordWmsOutboxEvent(tx, {
        eventName: "wms.transfer.requested",
        aggregateType: "WmsTransferRequest",
        aggregateId: req.id,
        payload: {
          requestId: req.id,
          itemId: item.id,
          sku: item.sku,
          quantity,
          fromWarehouse: item.warehouse,
          toWarehouse,
          requestedBy: sessionUser,
        },
      });

      return req;
    });

    logEvent({
      level: "audit",
      module: "WMS",
      action: "TRANSFER_REQUESTED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        requestId: created.id,
        itemId: item.id,
        sku: item.sku,
        quantity,
        fromWarehouse: item.warehouse,
        toWarehouse,
      },
    });

    return createSuccessResponse({ success: true, request: created }, request, 201);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg === "ALREADY_PROCESSED") {
      return createErrorResponse(
        "CONFLICT",
        "Заявка на перемещение уже была обработана (SEC-04)",
        undefined,
        409,
        request
      );
    }
    if (errMsg === "INSUFFICIENT_STOCK") {
      return createErrorResponse(
        "CONFLICT",
        "Недостаточно остатка на складе отправителя (SEC-16)",
        undefined,
        409,
        request
      );
    }
    console.error("WMS Transfer request POST failed:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "TRANSER_REQUEST_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка обработки межскладского перемещения",
      undefined,
      500,
      request
    );
  }
}
