import { getSession } from "@/lib/auth/session";
import { createSuccessResponse, createErrorResponse } from "@/lib/shell/api-response";

/**
 * GET /api/auth/me
 *
 * Возвращает текущую сессию пользователя.
 *
 * @returns {Promise<{ user: UserSession }>}
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return createErrorResponse(
      "UNAUTHORIZED",
      "Необходима авторизация",
      undefined,
      401
    );
  }

  return createSuccessResponse({ user: session });
}
