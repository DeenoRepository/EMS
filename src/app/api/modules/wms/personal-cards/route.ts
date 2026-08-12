import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { canReturnPersonalCard } from "@/lib/wms/state-machine";
import { recordWmsOutboxEvent } from "@/lib/wms/outbox-processor";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const personalCardsQuerySchema = z.object({
  employee: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const issueCardSchema = z.object({
  itemId: z.string().min(1, "Позиция ТМЦ обязательна"),
  employeeName: z.string().min(1, "ФИО сотрудника обязательно"),
  employeePosition: z.string().optional(),
  employeeNumber: z.string().optional(),
  department: z.string().optional(),
  quantity: z.coerce.number().int().positive("Количество должно быть целым положительным числом"),
  notes: z.string().optional(),
});

const returnCardSchema = z.object({
  cardId: z.string().min(1, "ID карточки обязателен"),
  returnCondition: z.enum(["GOOD", "REPAIR", "DAMAGE"]),
});

/**
 * GET /api/modules/wms/personal-cards
 *
 * Получить список записей личных карточек СИЗ с фильтрацией по сотруднику.
 * Применяется scope-based фильтрация по ответственным складам.
 *
 * @requires Permission: wms.personal_cards.manage
 * @returns {Promise<{ cards: WmsPersonalCard[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = personalCardsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { employee, limit, offset } = parseResult.data;

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: Record<string, unknown> = {};
    if (employee) {
      where.OR = [
        { employeeName: { contains: employee, mode: "insensitive" } },
        { employeeNumber: { contains: employee, mode: "insensitive" } },
        { employeePosition: { contains: employee, mode: "insensitive" } },
        { department: { contains: employee, mode: "insensitive" } },
      ];
    }

    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return createSuccessResponse({ cards: [], total: 0, limit, offset }, request);
      }
      where.item = {
        warehouse: { in: responsibleWarehouses },
      };
    }

    const [cards, total] = await Promise.all([
      prisma.wmsPersonalCard.findMany({
        where,
        orderBy: { issuedAt: "desc" },
        include: { item: true },
        take: limit,
        skip: offset,
      }),
      prisma.wmsPersonalCard.count({ where }),
    ]);

    return createSuccessResponse({ cards, total, limit, offset }, request);
  } catch (err) {
    console.error("WMS Personal cards GET failed:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "PERSONAL_CARDS_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка личных карточек",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/wms/personal-cards
 *
 * Выдать СИЗ/инструмент сотруднику в личную карточку.
 * Публикует доменное событие `wms.personal_card.issued` через Transactional Outbox.
 *
 * @requires Permission: wms.personal_cards.manage
 * @returns {Promise<{ success: true, card: WmsPersonalCard }>}
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

    const validation = issueCardSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Поля Позиция ТМЦ и ФИО обязательны, а количество должно быть целым положительным числом",
        validation.error.flatten(),
        400,
        request
      );
    }

    const { itemId, employeeName, employeePosition, employeeNumber, department, quantity, notes } =
      validation.data;

    const responsibleWarehouses = await getUserResponsibleWarehouses();

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.wmsItem.findUnique({ where: { id: itemId } });
      if (!item) {
        throw new Error("NOT_FOUND");
      }

      if (responsibleWarehouses !== null && !responsibleWarehouses.includes(item.warehouse)) {
        throw new Error("FORBIDDEN");
      }

      if (item.quantity < quantity) {
        throw new Error(`INSUFFICIENT_STOCK:${item.quantity}:${item.unit}`);
      }

      const card = await tx.wmsPersonalCard.create({
        data: {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          employeeName,
          employeePosition: employeePosition || null,
          employeeNumber: employeeNumber || null,
          department: department || null,
          issuedQuantity: quantity,
          notes: notes || null,
          createdById: session.id,
        },
      });

      const updatedQty = item.quantity - quantity;
      const newStatus =
        updatedQty <= 0
          ? "OUT_OF_STOCK"
          : updatedQty <= item.minQuantity
            ? "LOW_STOCK"
            : "IN_STOCK";

      await tx.wmsItem.update({
        where: { id: item.id },
        data: {
          quantity: updatedQty,
          status: newStatus,
        },
      });

      await tx.wmsMovement.create({
        data: {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          type: "PERSONAL_CARD",
          quantity,
          fromLocation: item.cell,
          toLocation: `Личная карточка: ${employeeName} (Таб. №${employeeNumber || "Б/Н"})`,
          performedBy: session.displayName || session.username,
          reason: `Выдача СИЗ/Инструмента сотруднику ${employeeName}`,
        },
      });

      await recordWmsOutboxEvent(tx, {
        eventName: "wms.personal_card.issued",
        aggregateType: "WmsPersonalCard",
        aggregateId: card.id,
        payload: {
          cardId: card.id,
          itemId: item.id,
          sku: item.sku,
          employeeName,
          quantity,
          performedBy: session.displayName || session.username,
        },
      });

      return card;
    });

    logEvent({
      level: "audit",
      module: "WMS",
      action: "PERSONAL_CARD_ISSUED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        cardId: result.id,
        itemId,
        employeeName,
        quantity,
      },
    });

    return createSuccessResponse({ success: true, card: result }, request, 201);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg === "NOT_FOUND") {
      return createErrorResponse(
        "NOT_FOUND",
        "Позиция ТМЦ не найдена",
        undefined,
        404,
        request
      );
    }
    if (errMsg === "FORBIDDEN") {
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Вы не являетесь МОЛ данного склада",
        undefined,
        403,
        request
      );
    }
    if (errMsg.startsWith("INSUFFICIENT_STOCK")) {
      const [, avail, unit] = errMsg.split(":");
      return createErrorResponse(
        "INSUFFICIENT_STOCK",
        `Недостаточно остатка на складе. Доступно: ${avail} ${unit}`,
        { available: Number(avail), unit },
        400,
        request
      );
    }
    console.error("WMS Personal card POST failed:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "PERSONAL_CARD_ISSUE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка при выдаче ТМЦ в личную карточку",
      undefined,
      500,
      request
    );
  }
}

/**
 * PUT /api/modules/wms/personal-cards
 *
 * Оформить возврат СИЗ/инструмента из личной карточки.
 */
export async function PUT(request: Request) {
  return handleReturn(request);
}

/**
 * PATCH /api/modules/wms/personal-cards
 *
 * Оформить возврат СИЗ/инструмента из личной карточки (альтернативный метод).
 */
export async function PATCH(request: Request) {
  return handleReturn(request);
}

async function handleReturn(request: Request) {
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

    const validation = returnCardSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Укажите ID карточки и техническое состояние при возврате",
        validation.error.format(),
        400,
        request
      );
    }

    const { cardId, returnCondition } = validation.data;

    const card = await prisma.wmsPersonalCard.findUnique({
      where: { id: cardId },
      include: { item: true },
    });

    if (!card) {
      return createErrorResponse(
        "NOT_FOUND",
        "Запись в личной карточке не найдена",
        undefined,
        404,
        request
      );
    }

    // SEC-05: Идемпотентность — проверка, что личная карточка еще не возвращена
    if (!canReturnPersonalCard(card.returnedAt)) {
      return createErrorResponse(
        "CONFLICT",
        "Данная позиция личной карточки уже была возвращена ранее (SEC-05)",
        { returnedAt: card.returnedAt },
        409,
        request
      );
    }

    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(card.item.warehouse)) {
      logEvent({
        level: "warn",
        module: "WMS",
        action: "PERSONAL_CARD_RETURN_DENIED_SCOPE",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { warehouse: card.item.warehouse, allowed: responsibleWarehouses },
      });
      return createErrorResponse(
        "FORBIDDEN",
        `Отказано в доступе. Вы не являетесь МОЛ склада "${card.item.warehouse}"`,
        undefined,
        403,
        request
      );
    }

    // В транзакции: атомарный условный возврат только при returnedAt IS NULL
    const isGood = returnCondition === "GOOD";
    const writeOffReason = returnCondition === "REPAIR" ? "EQUIPMENT_REPAIR" : "DAMAGE";

    const result = await prisma.$transaction(async (tx) => {
      const cardUpdate = await tx.wmsPersonalCard.updateMany({
        where: { id: cardId, returnedAt: null },
        data: {
          returnedAt: new Date(),
          returnCondition,
        },
      });

      if (cardUpdate.count === 0) {
        throw new Error("ALREADY_RETURNED");
      }

      if (isGood) {
        await tx.wmsItem.update({
          where: { id: card.itemId },
          data: {
            quantity: { increment: card.issuedQuantity },
            status:
              card.item.quantity + card.issuedQuantity <= card.item.minQuantity
                ? "LOW_STOCK"
                : "IN_STOCK",
          },
        });

        await tx.wmsMovement.create({
          data: {
            itemId: card.itemId,
            itemSku: card.itemSku,
            itemName: card.itemName,
            type: "INCOMING",
            quantity: card.issuedQuantity,
            fromLocation: `Личная карточка: ${card.employeeName}`,
            toLocation: card.item.cell,
            performedBy: session.displayName || session.username,
            reason: `Возврат из личной карточки (${employeeConditionLabel(returnCondition)})`,
          },
        });
      } else {
        await tx.wmsWriteOff.create({
          data: {
            itemId: card.itemId,
            itemSku: card.itemSku,
            itemName: card.itemName,
            quantity: card.issuedQuantity,
            reason: writeOffReason,
            performedBy: session.displayName || session.username,
            comments: `Возврат из личной карточки ${card.employeeName} в непригодном состоянии (${employeeConditionLabel(returnCondition)})`,
          },
        });

        await tx.wmsMovement.create({
          data: {
            itemId: card.itemId,
            itemSku: card.itemSku,
            itemName: card.itemName,
            type: "OUTGOING",
            quantity: card.issuedQuantity,
            fromLocation: `Личная карточка: ${card.employeeName}`,
            toLocation: "Утиль / Ремонт",
            performedBy: session.displayName || session.username,
            reason: `Списание при возврате из личной карточки (${employeeConditionLabel(returnCondition)})`,
          },
        });
      }

      await recordWmsOutboxEvent(tx, {
        eventName: "wms.personal_card.returned",
        aggregateType: "WmsPersonalCard",
        aggregateId: cardId,
        payload: {
          cardId,
          itemId: card.itemId,
          sku: card.itemSku,
          employeeName: card.employeeName,
          returnCondition,
          performedBy: session.displayName || session.username,
        },
      });

      return await tx.wmsPersonalCard.findUnique({ where: { id: cardId } });
    });

    logEvent({
      level: "audit",
      module: "WMS",
      action: "PERSONAL_CARD_RETURNED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        cardId,
        returnCondition,
        employeeName: card.employeeName,
      },
    });

    return createSuccessResponse({ success: true, card: result }, request);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg === "ALREADY_RETURNED") {
      return createErrorResponse(
        "CONFLICT",
        "Данная позиция личной карточки уже была возвращена (SEC-05)",
        undefined,
        409,
        request
      );
    }
    console.error("WMS Personal card return failed:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "PERSONAL_CARD_RETURN_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка при оформлении возврата",
      undefined,
      500,
      request
    );
  }
}

function employeeConditionLabel(cond: string) {
  if (cond === "GOOD") return "Исправно / Возвращено на склад";
  if (cond === "REPAIR") return "Требует ремонта";
  return "Списано в утиль";
}
