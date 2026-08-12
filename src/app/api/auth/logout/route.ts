import { cookies } from "next/headers";
import { clearSessionCookie } from "@/lib/auth/session";
import { revokeToken } from "@/lib/auth/token-blacklist";
import { logEvent } from "@/lib/telemetry/logger";
import { createSuccessResponse, createErrorResponse } from "@/lib/shell/api-response";

/**
 * POST /api/auth/logout
 *
 * Завершает сессию пользователя: отзывает JWT-токен и очищает cookie.
 *
 * @returns {Promise<{ success: true, message: string }>}
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("ems_session")?.value;

    if (token) {
      revokeToken(token);
    }

    await clearSessionCookie();

    logEvent({
      level: "audit",
      module: "AUTH",
      action: "LOGOUT",
      details: { tokenRevoked: Boolean(token) },
    });

    const response = createSuccessResponse({
      success: true,
      message: "Сессия успешно завершена",
    });
    response.cookies.set("ems_session", "", {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка при завершении сессии",
      undefined,
      500
    );
  }
}
