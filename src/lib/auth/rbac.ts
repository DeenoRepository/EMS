export type Role = string;

export interface RoleScopeConfig {
  allowedWarehouses?: string[];
  allowedDepartments?: string[];
  isGlobal?: boolean;
}

export interface UserSession {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roles: Role[];
  permissions?: string[];
  scopes?: RoleScopeConfig;
  department?: string;
}

// SEC-02: MOCK_USERS перемещены в отдельный dev-only файл
// Импортируйте из "@/lib/auth/mock-users.dev" только в development/test
// В production этот модуль возвращает пустой объект
export { MOCK_USERS } from "./mock-users.dev";

export function hasRole(user: UserSession | null, requiredRoles: Role[]): boolean {
  if (!user) return false;
  if (user.roles.includes("ADMIN")) return true;
  return requiredRoles.some((role) => user.roles.includes(role));
}

export function hasPermission(user: UserSession | null, permissionCode: string): boolean {
  if (!user) return false;
  if (user.roles.includes("ADMIN") || user.permissions?.includes("*")) return true;
  return user.permissions?.includes(permissionCode) ?? false;
}

import { MODULES_CONFIG, ModuleManifest } from "@/lib/config/modules";

/**
 * Динамически проверяет доступ пользователя к модулю на основе его ролей или разрешений
 */
export function hasModuleAccess(user: UserSession | null, moduleId: string): boolean {
  if (!user) return false;
  if (user.roles.includes("ADMIN") || user.permissions?.includes("*")) return true;

  // Проверка по разрешениям модуля
  if (user.permissions?.some((p) => p.startsWith(`${moduleId}.`))) {
    return true;
  }

  const manifest: ModuleManifest | undefined = MODULES_CONFIG[moduleId];
  if (!manifest) return false;

  return hasRole(user, manifest.requiredRoles);
}
