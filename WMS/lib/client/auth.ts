export type ClientUser = {
  id: string;
  email: string;
  displayName: string;
  roles: Array<"VIEWER" | "EDITOR" | "APPROVER" | "ADMIN">;
};

const roleRank: Record<ClientUser["roles"][number], number> = {
  VIEWER: 1,
  EDITOR: 2,
  APPROVER: 3,
  ADMIN: 4
};

export function hasAnyRole(user: ClientUser | null, roles: ClientUser["roles"][number][]) {
  if (!user) return false;
  return user.roles.some((r) => roles.includes(r));
}

export function hasAtLeastRole(user: ClientUser | null, role: ClientUser["roles"][number]) {
  if (!user) return false;
  const max = Math.max(...user.roles.map((r) => roleRank[r]));
  return max >= roleRank[role];
}
