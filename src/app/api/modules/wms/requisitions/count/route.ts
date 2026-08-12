import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/shell/api-response";

/**
 * GET /api/modules/wms/requisitions/count
 *
 * Получить количество межскладских запросов в статусе REQUESTED.
 *
 * @requires Permission: wms.transfers.manage
 * @returns {Promise<{ count: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  try {
    const count = await prisma.wmsRequisition.count({
      where: { status: "REQUESTED" },
    });
    return createSuccessResponse({ count }, request);
  } catch (err) {
    console.error("Failed to count pending WMS requisitions:", err);
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения количества запросов",
      undefined,
      500,
      request
    );
  }
}
