import { prisma } from "@/lib/db/prisma";
import { requireSession, requireRole } from "@/lib/auth/guards";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const createAttributeSchema = z.object({
  typeValue: z.string().min(1, "typeValue обязателен"),
  key: z.string().min(1, "key обязателен"),
  label: z.string().min(1, "label обязателен"),
  dataType: z.string().optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * GET /api/equipment-type-attributes
 *
 * Получить список атрибутов типов оборудования с фильтрацией по типу.
 *
 * @returns {Promise<{ items: EquipmentTypeAttribute[] }>}
 */
export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const typeValue = searchParams.get("type") || undefined;

  try {
    const items = await prisma.equipmentTypeAttribute.findMany({
      where: {
        ...(typeValue ? { typeValue } : {}),
        isActive: true,
      },
      orderBy: [{ typeValue: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });

    return createSuccessResponse({ items }, request);
  } catch (err) {
    console.error("GET /api/equipment-type-attributes failed:", err);
    logEvent({
      level: "error",
      module: "EPS",
      action: "TYPE_ATTRIBUTES_LIST_FAILED",
      userId: auth.session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения атрибутов типов оборудования",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/equipment-type-attributes
 *
 * Создать новый атрибут типа оборудования (только ADMIN/EDITOR).
 *
 * @requires Role: ADMIN или EDITOR
 * @returns {Promise<{ success: true, attribute: EquipmentTypeAttribute }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  const auth = await requireSession(request);
  if (!auth.authorized) return auth.response;

  const roleAuth = requireRole(auth.session, ["ADMIN", "EDITOR"], request);
  if (!roleAuth.authorized) return roleAuth.response;

  try {
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

    const validation = createAttributeSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные параметры атрибута",
        validation.error.format(),
        400,
        request
      );
    }

    const { typeValue, key, label, dataType, required, sortOrder } = validation.data;

    const created = await prisma.equipmentTypeAttribute.create({
      data: {
        typeValue: typeValue.trim(),
        key: key.trim().toLowerCase(),
        label: label.trim(),
        dataType: dataType || "TEXT",
        required: required ?? false,
        isActive: true,
        sortOrder: sortOrder ?? 0,
      },
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "TYPE_ATTRIBUTE_CREATED",
      userId: auth.session.id,
      userEmail: auth.session.email,
      requestId: correlationId,
      details: { attributeId: created.id, typeValue, key: created.key },
    });

    return createSuccessResponse({ success: true, attribute: created }, request, 201);
  } catch (err) {
    console.error("POST /api/equipment-type-attributes failed:", err);
    logEvent({
      level: "error",
      module: "EPS",
      action: "TYPE_ATTRIBUTE_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка создания характеристического атрибута",
      undefined,
      500,
      request
    );
  }
}
