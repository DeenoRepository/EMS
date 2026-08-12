import { prisma } from "@/lib/db/prisma";
import { WmsRequisitionStatus } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { logEvent } from "@/lib/telemetry/logger";
import { ShellEventBus } from "@/lib/shell/event-bus";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const requisitionItemSchema = z.object({
  itemId: z.string().min(1),
  itemSku: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

const createRequisitionSchema = z.object({
  fromWarehouse: z.string().min(1, "Склад-источник обязателен"),
  toWarehouse: z.string().min(1, "Склад-получатель обязателен"),
  note: z.string().optional(),
  items: z.array(requisitionItemSchema).min(1, "Список товаров не может быть пустым"),
});

const requisitionsQuerySchema = z.object({
  fromWarehouse: z.string().optional(),
  toWarehouse: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/modules/wms/requisitions
 *
 * Получить список межскладских запросов с фильтрацией.
 * Применяется scope-based фильтрация по ответственным складам.
 *
 * @requires Permission: wms.transfers.manage
 * @returns {Promise<{ requisitions: WmsRequisition[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = requisitionsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { fromWarehouse, toWarehouse, status, limit, offset } = parseResult.data;

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: Record<string, unknown> = {};
    if (fromWarehouse) where.fromWarehouse = fromWarehouse;
    if (toWarehouse) where.toWarehouse = toWarehouse;
    if (status) where.status = status as WmsRequisitionStatus;

    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return createSuccessResponse({ requisitions: [], total: 0, limit, offset }, request);
      }
      where.OR = [
        { fromWarehouse: { in: responsibleWarehouses } },
        { toWarehouse: { in: responsibleWarehouses } },
      ];
    }

    const [requisitions, total] = await Promise.all([
      prisma.wmsRequisition.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.wmsRequisition.count({ where }),
    ]);

    return createSuccessResponse({ requisitions, total, limit, offset }, request);
  } catch (err) {
    console.error("Failed to fetch WMS requisitions:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "REQUISITIONS_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка запросов",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/wms/requisitions
 *
 * Создать межскладской запрос на перемещение ТМЦ.
 * Публикует доменное событие `wms.transfer.requested`.
 *
 * @requires Permission: wms.transfers.manage
 * @returns {Promise<{ success: true, requisition: WmsRequisition }>}
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

    const validation = createRequisitionSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Все ключевые поля (Склад-источник, Склад-получатель, Товары) обязательны",
        validation.error.format(),
        400,
        request
      );
    }

    const { fromWarehouse, toWarehouse, note, items } = validation.data;

    // SEC-09: Проверка прав на склад-получатель
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    if (responsibleWarehouses !== null && !responsibleWarehouses.includes(toWarehouse)) {
      logEvent({
        level: "warn",
        module: "WMS",
        action: "REQUISITION_CREATE_DENIED_SCOPE",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { toWarehouse, allowed: responsibleWarehouses },
      });
      return createErrorResponse(
        "FORBIDDEN",
        `Отказано в доступе. Только МОЛ склада-получателя ("${toWarehouse}") может запрашивать СИЗ/ТМЦ.`,
        undefined,
        403,
        request
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
          create: items.map((item) => ({
            itemId: item.itemId,
            itemSku: item.itemSku,
            itemName: item.itemName,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    logEvent({
      level: "audit",
      module: "WMS",
      action: "REQUISITION_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        requisitionId: requisition.id,
        requisitionNumber,
        fromWarehouse,
        toWarehouse,
        itemsCount: items.length,
      },
    });

    await ShellEventBus.publish(
      "wms.transfer.requested",
      "WMS",
      {
        requisitionId: requisition.id,
        requisitionNumber,
        fromWarehouse,
        toWarehouse,
        itemsCount: items.length,
        requestedBy,
      },
      correlationId
    );

    return createSuccessResponse({ success: true, requisition }, request, 201);
  } catch (err) {
    console.error("Failed to create WMS requisition:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "REQUISITION_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка при создании межскладского запроса",
      undefined,
      500,
      request
    );
  }
}
