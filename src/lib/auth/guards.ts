import { NextResponse } from "next/server";
import { getSession } from "./session";
import { Role, UserSession, hasRole, hasModuleAccess } from "./rbac";

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
 * Извлекает текущую сессию пользователя или возвращает 401 Unauthorized
 */
export async function requireSession(): Promise<GuardResult> {
  const session = await getSession();
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Необходима авторизация" },
        { status: 401 }
      ),
    };
  }

  return { authorized: true, session };
}

/**
 * Проверяет наличие требуемой роли у сессии пользователя или возвращает 403 Forbidden
 */
export function requireRole(
  session: UserSession,
  allowedRoles: Role[]
): GuardResult {
  if (hasRole(session, allowedRoles)) {
    return { authorized: true, session };
  }

  return {
    authorized: false,
    response: NextResponse.json(
      {
        error: "Отказано в доступе: недостаточно прав для выполнения операции (SEC-09)",
        requiredRoles: allowedRoles,
      },
      { status: 403 }
    ),
  };
}

/**
 * Проверяет доступ только для Администраторов (ADMIN)
 */
export function requireAdmin(session: UserSession): GuardResult {
  return requireRole(session, ["ADMIN"]);
}

/**
 * Проверяет доступ пользователя к модулю по его ID (например 'eps', 'wms', 'admin')
 */
export function requireModulePermission(
  session: UserSession,
  moduleId: string
): GuardResult {
  if (hasModuleAccess(session, moduleId)) {
    return { authorized: true, session };
  }

  return {
    authorized: false,
    response: NextResponse.json(
      {
        error: `Отказано в доступе к модулю "${moduleId}" (SEC-09)`,
      },
      { status: 403 }
    ),
  };
}
