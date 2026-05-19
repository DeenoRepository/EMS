import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, parseSessionToken } from "@/lib/server/auth";

export async function getSession(req: NextRequest) {
  const token = req.cookies.get(getSessionCookieName())?.value;
  const payload = parseSessionToken(token);
  if (!payload) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(payload.userId) },
      include: { userRoles: { include: { role: true } } }
    });
    if (!user) return null;
    return {
      id: user.id,
      login: user.login,
      displayName: user.displayName,
      roles: user.userRoles.map((x) => x.role.name)
    };
  } catch {
    return {
      id: BigInt(0),
      login: payload.login,
      displayName: payload.login,
      roles: payload.roles as any
    };
  }
}

export function hasRole(roles: string[], allowed: string[]) {
  return roles.some((role) => allowed.includes(role));
}
