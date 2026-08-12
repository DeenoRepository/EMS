import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/shell/api-response";

/**
 * GET /api/modules/eps/approval-queue/count
 *
 * Получить количество заявок на согласование в статусе PENDING.
 *
 * @requires Permission: eps.approvals.decide
 * @returns {Promise<{ count: number, timestamp: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  try {
    const pendingCount = await prisma.approvalRequest.count({
      where: { status: "PENDING" },
    });

    return createSuccessResponse({ count: pendingCount, timestamp: Date.now() }, request);
  } catch (error) {
    console.error("[EPS Approval Queue Count] DB error:", error);
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения очереди согласований",
      undefined,
      500,
      request
    );
  }
}
