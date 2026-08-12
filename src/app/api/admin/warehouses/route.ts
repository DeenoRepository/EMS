import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const createWarehouseSchema = z.object({
  name: z.string().min(1, "Поле name обязательно"),
  responsibleUser: z.string().min(1, "Поле responsibleUser обязательно"),
  responsibleUsername: z.string().optional(),
});

/**
 * GET /api/admin/warehouses
 *
 * Получить список всех складов (только ADMIN).
 *
 * @requires Role: ADMIN
 * @returns {Promise<{ warehouses: Warehouse[] }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  if (!hasRole(session, ["ADMIN"])) {
    return createErrorResponse(
      "FORBIDDEN",
      "Отказано в доступе. Требуются права администратора.",
      undefined,
      403,
      request
    );
  }

  try {
    const warehouses = await prisma.warehouse.findMany({
      include: { storageCells: true },
      orderBy: { name: "asc" },
    });
    return createSuccessResponse({ warehouses }, request);
  } catch (err) {
    console.error("Failed to fetch warehouses:", err);
    logEvent({
      level: "error",
      module: "ADMIN",
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
 * POST /api/admin/warehouses
 *
 * Создать новый склад (только ADMIN).
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

    if (!hasRole(session, ["ADMIN"])) {
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Требуются права администратора.",
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
        "Поля name и responsibleUser обязательны",
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
        responsibleUsername: responsibleUsername || null,
      },
    });

    logEvent({
      level: "audit",
      module: "ADMIN",
      action: "WAREHOUSE_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { warehouseId: warehouse.id, name, responsibleUser },
    });

    return createSuccessResponse({ success: true, warehouse }, request, 201);
  } catch (err) {
    console.error("Failed to create warehouse:", err);
    logEvent({
      level: "error",
      module: "ADMIN",
      action: "WAREHOUSE_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка создания склада",
      undefined,
      500,
      request
    );
  }
}
