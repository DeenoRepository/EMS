import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";

/**
 * DELETE /api/reference/fields/[id]
 *
 * Удалить справочное поле (только ADMIN).
 *
 * @requires Role: ADMIN
 * @returns {Promise<{ success: true }>}
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    if (!hasRole(session, ["ADMIN"])) {
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Удаление справочников доступно только администратору.",
        undefined,
        403,
        request
      );
    }

    const { id } = await params;

    await prisma.referenceField.delete({ where: { id } });

    logEvent({
      level: "audit",
      module: "REFERENCE",
      action: "FIELD_DELETED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { fieldId: id },
    });

    return createSuccessResponse({ success: true }, request);
  } catch (err) {
    console.error("DELETE /api/reference/fields/[id] error:", err);
    logEvent({
      level: "error",
      module: "REFERENCE",
      action: "FIELD_DELETE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка удаления справочника",
      undefined,
      500,
      request
    );
  }
}
