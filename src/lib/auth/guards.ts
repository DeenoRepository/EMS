import { getSession } from "./session";
import { Role, UserSession, hasRole, hasModuleAccess } from "./rbac";
import { createErrorResponse } from "@/lib/shell/api-response";
import type { NextResponse } from "next/server";

export interface GuardAuthSuccess {
  authorized: true;
  session: UserSession;
}

export interface GuardAuthFailure {
  authorized: false;
  response: NextResponse;
}

export type GuardResult = GuardAuthSuccess | GuardAuthFailure;

/**
 * Извлекает текущую сессию пользователя или возвращает 401 Unauthorized.
 * Использует единый формат ответов API (см. docs/rules/07-api-conventions.md).
 */
export async function requireSession(request?: Request): Promise<GuardResult> {
  const session = await getSession();
  if (!session) {
    return {
      authorized: false,
      response: createErrorResponse(
        "UNAUTHORIZED",
        "Необходима авторизация",
        undefined,
        401,
        request
      ),
    };
  }

  return { authorized: true, session };
}

/**
 * Проверяет наличие требуемой роли у сессии пользователя или возвращает 403 Forbidden.
 */
export function requireRole(
  session: UserSession,
  allowedRoles: Role[],
  request?: Request
): GuardResult {
  if (hasRole(session, allowedRoles)) {
    return { authorized: true, session };
  }

  return {
    authorized: false,
    response: createErrorResponse(
      "FORBIDDEN",
      "Отказано в доступе: недостаточно прав для выполнения операции (SEC-09)",
      { requiredRoles: allowedRoles },
      403,
      request
    ),
  };
}

/**
 * Проверяет доступ только для Администраторов (ADMIN).
 */
export function requireAdmin(session: UserSession, request?: Request): GuardResult {
  return requireRole(session, ["ADMIN"], request);
}

/**
 * Проверяет доступ пользователя к модулю по его ID (например 'eps', 'wms', 'admin').
 */
export function requireModulePermission(
  session: UserSession,
  moduleId: string,
  request?: Request
): GuardResult {
  if (hasModuleAccess(session, moduleId)) {
    return { authorized: true, session };
  }

  return {
    authorized: false,
    response: createErrorResponse(
      "FORBIDDEN",
      `Отказано в доступе к модулю "${moduleId}" (SEC-09)`,
      undefined,
      403,
      request
    ),
  };
}
