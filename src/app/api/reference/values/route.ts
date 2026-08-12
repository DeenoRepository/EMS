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

const createValueSchema = z.object({
  fieldId: z.string().min(1, "fieldId обязателен"),
  value: z.string().min(1, "value обязателен"),
  label: z.string().min(1, "label обязателен"),
  sortOrder: z.number().int().optional(),
});

/**
 * POST /api/reference/values
 *
 * Создать новый элемент справочника (только ADMIN/EDITOR).
 *
 * @requires Role: ADMIN или EDITOR
 * @returns {Promise<{ success: true, value: ReferenceValue }>}
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

    const validation = createValueSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные параметры элемента справочника",
        validation.error.format(),
        400,
        request
      );
    }

    const { fieldId, value, label, sortOrder } = validation.data;

    const createdValue = await prisma.referenceValue.create({
      data: {
        fieldId,
        value: value.trim(),
        label: label.trim(),
        isActive: true,
        sortOrder: sortOrder ?? 0,
      },
    });

    logEvent({
      level: "audit",
      module: "REFERENCE",
      action: "VALUE_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { valueId: createdValue.id, fieldId, value: createdValue.value },
    });

    return createSuccessResponse({ success: true, value: createdValue }, request, 201);
  } catch (err) {
    console.error("POST /api/reference/values failed:", err);
    logEvent({
      level: "error",
      module: "REFERENCE",
      action: "VALUE_CREATE_FAILED",
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка создания элемента справочника",
      undefined,
      500,
      request
    );
  }
}
