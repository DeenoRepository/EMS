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
 * DELETE /api/reference/values/[id]
 *
 * Удалить элемент справочника (только ADMIN).
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
        "Отказано в доступе. Удаление элементов справочника доступно только администратору.",
        undefined,
        403,
        request
      );
    }

    const { id } = await params;

    await prisma.referenceValue.delete({ where: { id } });

    logEvent({
      level: "audit",
      module: "REFERENCE",
      action: "VALUE_DELETED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { valueId: id },
    });

    return createSuccessResponse({ success: true }, request);
  } catch (err) {
    console.error("DELETE /api/reference/values/[id] error:", err);
    logEvent({
      level: "error",
      module: "REFERENCE",
      action: "VALUE_DELETE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка удаления элемента справочника",
      undefined,
      500,
      request
    );
  }
}
