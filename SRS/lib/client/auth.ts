import type { RoleKey } from "@prisma/client";

export type ClientUser = {
  id?: string;
  email?: string;
  displayName?: string;
  roles: RoleKey[];
};

export function hasAnyRole(user: ClientUser | null | undefined, roles: RoleKey[]) {
  if (!user) return false;
  return user.roles.some((r) => roles.includes(r));
}

export function hasAtLeastRole(user: ClientUser | null | undefined, required: RoleKey) {
  if (!user) return false;
  const rank: Record<RoleKey, number> = { VIEWER: 10, EDITOR: 20, APPROVER: 30, ADMIN: 40 };
  const maxRole = user.roles.reduce((acc, role) => Math.max(acc, rank[role]), 0);
  return maxRole >= rank[required];
}
