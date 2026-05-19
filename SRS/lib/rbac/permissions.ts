import type { RoleKey } from "@prisma/client";

export const ROLE_RANK: Record<RoleKey, number> = {
  VIEWER: 10,
  EDITOR: 20,
  APPROVER: 30,
  ADMIN: 40
};

export function hasAtLeastRole(userRoles: RoleKey[], required: RoleKey) {
  const maxRole = userRoles.reduce((acc, role) => Math.max(acc, ROLE_RANK[role]), 0);
  return maxRole >= ROLE_RANK[required];
}

export function hasAnyRole(userRoles: RoleKey[], required: RoleKey[]) {
  return required.some((role) => userRoles.includes(role));
}
