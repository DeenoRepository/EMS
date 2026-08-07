export type Role = "ADMIN" | "EDITOR" | "APPROVER" | "VIEWER";

export interface UserSession {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roles: Role[];
}

// MOCK_USERS используется ИСКЛЮЧИТЕЛЬНО в режиме разработки/демонстрации без внешней БД LDAP
// В продуктивном контуре используется LDAP Bind Authentication через /api/auth/login
export const MOCK_USERS: Record<string, UserSession & { _devPassword: string }> = {
  admin: {
    id: "usr-admin",
    username: "admin",
    displayName: "Администратор EMS",
    email: "admin@ems.local",
    roles: ["ADMIN", "EDITOR", "APPROVER", "VIEWER"],
    _devPassword: "admin123" // DEV-ONLY: Plaintext fallback для локальной разработки
  },
  editor: {
    id: "usr-editor",
    username: "editor",
    displayName: "Инженер Редактор",
    email: "editor@ems.local",
    roles: ["EDITOR", "VIEWER"],
    _devPassword: "editor123" // DEV-ONLY
  },
  approver: {
    id: "usr-approver",
    username: "approver",
    displayName: "Руководитель Согласующий",
    email: "approver@ems.local",
    roles: ["APPROVER", "VIEWER"],
    _devPassword: "approver123" // DEV-ONLY
  },
  viewer: {
    id: "usr-viewer",
    username: "viewer",
    displayName: "Наблюдатель Оборудования",
    email: "viewer@ems.local",
    roles: ["VIEWER"],
    _devPassword: "viewer123" // DEV-ONLY
  }
};

export function hasRole(user: UserSession | null, requiredRoles: Role[]): boolean {
  if (!user) return false;
  if (user.roles.includes("ADMIN")) return true;
  return requiredRoles.some((role) => user.roles.includes(role));
}
