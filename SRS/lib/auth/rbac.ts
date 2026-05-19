import { NextResponse } from "next/server";
import type { RoleKey } from "@prisma/client";
import { hasAtLeastRole, hasAnyRole } from "@/lib/rbac/permissions";
import { getCurrentUser } from "@/lib/auth/provider";

export async function requireRole(required: RoleKey) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    throw new Response("Unauthorized", { status: 401 });
  }
  if (!hasAtLeastRole(user.roles, required)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}

export async function requireAnyRole(required: RoleKey[]) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    throw new Response("Unauthorized", { status: 401 });
  }
  if (!hasAnyRole(user.roles, required)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}
