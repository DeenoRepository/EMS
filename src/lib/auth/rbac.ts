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

// MOCK_USERS используется ИСКЛЮЧИТЕЛЬНО в режиме разработки/демонстрации без внешней БД LDAP
export const MOCK_USERS: Record<string, UserSession & { _devPassword: string }> = {
  admin: {
    id: "usr-admin",
    username: "admin",
    displayName: "Администратор EMS",
    email: "admin@ems.local",
    roles: ["ADMIN"],
    permissions: ["*"],
    _devPassword: "admin123"
  },
  storekeeper: {
    id: "usr-storekeeper",
    username: "storekeeper",
    displayName: "Сидоров И.К. (Кладовщик WMS)",
    email: "storekeeper@ems.local",
    roles: ["wms_storekeeper"],
    permissions: [
      "wms.items.read", "wms.items.create", "wms.items.update",
      "wms.movements.execute", "wms.personal_cards.manage",
      "wms.transfers.manage", "wms.writeoffs.manage", "wms.topology.manage",
      "eps.equipment.read"
    ],
    _devPassword: "storekeeper123"
  },
  editor: {
    id: "usr-editor",
    username: "editor",
    displayName: "Инженер Редактор",
    email: "editor@ems.local",
    roles: ["eps_engineer"],
    permissions: [
      "eps.equipment.read", "eps.equipment.create", "eps.equipment.update",
      "eps.documents.manage", "eps.reports.export", "wms.items.read"
    ],
    _devPassword: "editor123"
  },
  approver: {
    id: "usr-approver",
    username: "approver",
    displayName: "Руководитель Согласующий",
    email: "approver@ems.local",
    roles: ["eps_approver"],
    permissions: [
      "eps.equipment.read", "eps.approvals.decide", "eps.reports.export",
      "wms.items.read", "wms.transfers.manage"
    ],
    _devPassword: "approver123"
  },
  viewer: {
    id: "usr-viewer",
    username: "viewer",
    displayName: "Наблюдатель Оборудования",
    email: "viewer@ems.local",
    roles: ["viewer_readonly"],
    permissions: ["eps.equipment.read", "wms.items.read"],
    _devPassword: "viewer123"
  }
};

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
