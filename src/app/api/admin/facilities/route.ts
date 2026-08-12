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

const createFacilitySchema = z.object({
  code: z.string().min(1, "Поле code обязательно"),
  name: z.string().min(1, "Поле name обязательно"),
  address: z.string().optional(),
});

/**
 * GET /api/admin/facilities
 *
 * Получить список объектов предприятия (только ADMIN).
 *
 * @requires Role: ADMIN
 * @returns {Promise<{ facilities: EnterpriseFacility[] }>}
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
    const facilities = await prisma.enterpriseFacility.findMany({
      orderBy: { name: "asc" },
    });
    return createSuccessResponse({ facilities }, request);
  } catch (err) {
    console.error("Failed to fetch facilities:", err);
    logEvent({
      level: "error",
      module: "ADMIN",
      action: "FACILITIES_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка объектов предприятия",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/admin/facilities
 *
 * Создать новый объект предприятия (только ADMIN).
 *
 * @requires Role: ADMIN
 * @returns {Promise<{ success: true, facility: EnterpriseFacility }>}
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

    const validation = createFacilitySchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Поля name и code обязательны",
        validation.error.format(),
        400,
        request
      );
    }

    const { code, name, address } = validation.data;

    const facility = await prisma.enterpriseFacility.create({
      data: {
        code,
        name,
        address: address || null,
      },
    });

    logEvent({
      level: "audit",
      module: "ADMIN",
      action: "FACILITY_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { facilityId: facility.id, code, name },
    });

    return createSuccessResponse({ success: true, facility }, request, 201);
  } catch (err) {
    console.error("Failed to create facility:", err);
    logEvent({
      level: "error",
      module: "ADMIN",
      action: "FACILITY_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка создания объекта предприятия",
      undefined,
      500,
      request
    );
  }
}
