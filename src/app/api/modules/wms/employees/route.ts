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

const employeesQuerySchema = z.object({
  query: z.string().optional(),
  department: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const createEmployeeSchema = z.object({
  name: z.string().min(1, "ФИО обязательно"),
  employeeNumber: z.string().min(1, "Табельный номер обязателен"),
  position: z.string().optional(),
  department: z.string().optional(),
  warehouse: z.string().optional(),
});

/**
 * GET /api/modules/wms/employees
 *
 * Получить реестр сотрудников с фильтрацией по подразделению и поиску.
 *
 * @requires Permission: wms.personal_cards.manage
 * @returns {Promise<{ employees: WmsEmployee[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = employeesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { query, department, limit, offset } = parseResult.data;

  try {
    const where: Record<string, unknown> = { isActive: true };
    if (department && department !== "ALL") {
      where.department = department;
    }
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { employeeNumber: { contains: query, mode: "insensitive" } },
        { position: { contains: query, mode: "insensitive" } },
        { department: { contains: query, mode: "insensitive" } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.wmsEmployee.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.wmsEmployee.count({ where }),
    ]);

    return createSuccessResponse({ employees, total, limit, offset }, request);
  } catch (err) {
    console.error("WMS Employees GET failed:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "EMPLOYEES_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка сотрудников",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/wms/employees
 *
 * Зарегистрировать или обновить сотрудника в реестре (только ADMIN/EDITOR).
 *
 * @requires Role: ADMIN или EDITOR
 * @returns {Promise<{ success: true, employee: WmsEmployee, created?: boolean, updated?: boolean }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    if (!hasRole(session, ["ADMIN", "EDITOR"])) {
      logEvent({
        level: "warn",
        module: "WMS",
        action: "EMPLOYEE_CREATE_DENIED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Регистрация сотрудников доступна только редакторам и администраторам.",
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

    const validation = createEmployeeSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Поля ФИО и Табельный номер обязательны",
        validation.error.format(),
        400,
        request
      );
    }

    const { name, employeeNumber, position, department, warehouse } = validation.data;

    // Check existing by employeeNumber
    const existing = await prisma.wmsEmployee.findUnique({
      where: { employeeNumber },
    });

    if (existing) {
      const updated = await prisma.wmsEmployee.update({
        where: { id: existing.id },
        data: {
          name,
          position: position || existing.position,
          department: department || existing.department,
          warehouse: warehouse || existing.warehouse,
          isActive: true,
        },
      });

      logEvent({
        level: "audit",
        module: "WMS",
        action: "EMPLOYEE_UPDATED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { employeeId: updated.id, employeeNumber },
      });

      return createSuccessResponse({ success: true, employee: updated, updated: true }, request);
    }

    const employee = await prisma.wmsEmployee.create({
      data: {
        name,
        employeeNumber,
        position: position || "Сотрудник",
        department: department || "Основное производство",
        warehouse: warehouse || "Главный склад",
        isActive: true,
      },
    });

    logEvent({
      level: "audit",
      module: "WMS",
      action: "EMPLOYEE_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { employeeId: employee.id, employeeNumber, name },
    });

    return createSuccessResponse({ success: true, employee, created: true }, request, 201);
  } catch (err) {
    const errCode = (err as { code?: string }).code;
    if (errCode === "P2002") {
      return createErrorResponse(
        "CONFLICT",
        "Сотрудник с таким табельным номером уже существует",
        undefined,
        409,
        request
      );
    }
    console.error("WMS Employees POST failed:", err);
    logEvent({
      level: "error",
      module: "WMS",
      action: "EMPLOYEE_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка при добавлении сотрудника в реестр",
      undefined,
      500,
      request
    );
  }
}
