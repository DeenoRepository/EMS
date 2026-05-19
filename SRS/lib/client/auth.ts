export type ClientRole = "ADMIN" | "EDITOR" | "VIEWER";

export type ClientUser = {
  id?: string;
  email?: string;
  login?: string;
  displayName?: string;
  roles: ClientRole[];
};

export function hasAnyRole(user: ClientUser | null | undefined, roles: ClientRole[]) {
  if (!user) return false;
  return user.roles.some((r) => roles.includes(r));
}
