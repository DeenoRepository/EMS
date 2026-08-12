import { prisma } from "@/lib/db/prisma";
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const warehousesQuerySchema = z.object({
  query: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createWarehouseSchema = z.object({
  name: z.string().min(1, "Название склада обязательно"),
  responsibleUser: z.string().min(1, "Ответственное лицо (МОЛ) обязательно"),
  responsibleUsername: z.string().optional(),
});

/**
 * GET /api/modules/wms/warehouses
 *
 * Получить список складов с фильтрацией по поисковому запросу.
 * Применяется scope-based фильтрация по ответственным складам.
 *
 * @requires Permission: wms.items.read
 * @returns {Promise<{ warehouses: Warehouse[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = warehousesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { query, limit, offset } = parseResult.data;

  try {
    const responsibleWarehouses = await getUserResponsibleWarehouses();
    const where: Record<string, unknown> = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { responsibleUser: { contains: query, mode: "insensitive" } },
      ];
    }

    if (responsibleWarehouses !== null) {
      if (responsibleWarehouses.length === 0) {
        return createSuccessResponse({ warehouses: [], total: 0, limit, offset }, request);
      }
      where.name = { in: responsibleWarehouses };
    }

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        include: { storageCells: true },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.warehouse.count({ where: Object.keys(where).length > 0 ? where : undefined }),
    ]);

    return createSuccessResponse({ warehouses, total, limit, offset }, request);
  } catch (err) {
    console.error("WMS Warehouses query failed:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "WAREHOUSES_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка складов",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/wms/warehouses
 *
 * Создать новый склад и назначить МОЛ (только ADMIN).
 *
 * @requires Role: ADMIN
 * @returns {Promise<{ success: true, warehouse: Warehouse }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    // Создание складов и назначение МОЛ доступно только администраторам
    if (!hasRole(session, ["ADMIN"])) {
      logEvent({
        level: "warn",
        module: "WMS",
        action: "WAREHOUSE_CREATE_DENIED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Управление складами и назначение МОЛ доступно только администратору.",
        undefined,
        403,
        request
      );
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

    const validation = createWarehouseSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Название склада и ответственное лицо (МОЛ) обязательны",
        validation.error.format(),
        400,
        request
      );
    }

    const { name, responsibleUser, responsibleUsername } = validation.data;

    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        responsibleUser,
        responsibleUsername: responsibleUsername || responsibleUser,
      },
    });

    logEvent({
      level: "audit",
      module: "WMS",
      action: "WAREHOUSE_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        warehouseId: warehouse.id,
        name,
        responsibleUser,
      },
    });

    return createSuccessResponse({ success: true, warehouse }, request, 201);
  } catch (err) {
    console.error("Failed to create warehouse:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "WAREHOUSE_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Не удалось создать склад",
      undefined,
      500,
      request
    );
  }
}
