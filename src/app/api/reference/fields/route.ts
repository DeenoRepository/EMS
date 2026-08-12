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

const createFieldSchema = z.object({
  key: z.string().min(1, "key обязателен"),
  label: z.string().min(1, "label обязателен"),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * GET /api/reference/fields
 *
 * Получить список справочных полей с их значениями.
 *
 * @returns {Promise<{ fields: ReferenceField[] }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  try {
    const fields = await prisma.referenceField.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      include: {
        values: {
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        },
      },
    });

    return createSuccessResponse({ fields }, request);
  } catch (err) {
    console.error("GET /api/reference/fields failed:", err);
    logEvent({
      level: "error",
      module: "REFERENCE",
      action: "FIELDS_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения справочных полей",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/reference/fields
 *
 * Создать новое справочное поле (только ADMIN/EDITOR).
 *
 * @requires Role: ADMIN или EDITOR
 * @returns {Promise<{ success: true, field: ReferenceField }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    if (!hasRole(session, ["ADMIN", "EDITOR"])) {
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе",
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

    const validation = createFieldSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные параметры справочного поля",
        validation.error.format(),
        400,
        request
      );
    }

    const { key, label, description, sortOrder } = validation.data;

    const createdField = await prisma.referenceField.create({
      data: {
        entityType: "EQUIPMENT",
        key: key.trim().toLowerCase(),
        label: label.trim(),
        description: description?.trim(),
        isActive: true,
        sortOrder: sortOrder ?? 0,
      },
    });

    logEvent({
      level: "audit",
      module: "REFERENCE",
      action: "FIELD_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { fieldId: createdField.id, key: createdField.key },
    });

    return createSuccessResponse({ success: true, field: createdField }, request, 201);
  } catch (err) {
    console.error("POST /api/reference/fields failed:", err);
    logEvent({
      level: "error",
      module: "REFERENCE",
      action: "FIELD_CREATE_FAILED",
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка создания справочного поля",
      undefined,
      500,
      request
    );
  }
}
