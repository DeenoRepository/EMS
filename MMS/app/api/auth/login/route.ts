import { NextRequest, NextResponse } from "next/server";
import { lookupExternalIdentity } from "@/lib/auth/provider";
import { AUTH_COOKIE, DEMO_COOKIE, clearCookieOptions, sessionCookieOptions } from "@/lib/auth/session";
import { checkRateLimit, enforceSameOrigin, getClientIp, rateLimitResponse } from "@/lib/security/request";
import { writeAuditLog } from "@/lib/audit";
import { log } from "@/lib/observability/logger";
import { prisma } from "@/lib/db/prisma";
import type { RoleKey } from "@prisma/client";

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);

  const ip = getClientIp(req);
  const limit = checkRateLimit({ key: `auth:login:${ip}`, limit: 20, windowMs: 60_000 });
  if (!limit.allowed) {
    log.warn("auth_login_rate_limited", { ip, resetInMs: limit.resetInMs });
    return rateLimitResponse(limit.resetInMs);
  }

  const body = await req.json().catch(() => ({}));
  const login = typeof body?.login === "string" ? body.login.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!login) {
    log.warn("auth_login_failed_empty_login", { ip });
    return NextResponse.json({ error: "Логин обязателен" }, { status: 400 });
  }

  const isLdap = (process.env.AUTH_PROVIDER || "mock").toLowerCase() === "ldap";
  if (isLdap && !password.trim()) {
    log.warn("auth_login_failed_empty_password", { ip, login });
    return NextResponse.json({ error: "Пароль обязателен" }, { status: 400 });
  }

  const result = await lookupExternalIdentity(login, password);
  if (!result.identity) {
    log.warn("auth_login_failed", { ip, login, provider: result.provider });
    await writeAuditLog({
      actorEmail: login,
      action: "LOGIN",
      entityType: "Auth",
      entityId: "login",
      metadata: { ok: false, reason: "invalid_credentials_or_not_found", ip, login, provider: result.provider }
    });
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  await writeAuditLog({
    actorEmail: result.identity.email.trim().toLowerCase(),
    action: "LOGIN",
    entityType: "Auth",
    entityId: "login",
    metadata: { ok: true, provider: result.provider, roles: result.roles, ip }
  });
  log.info("auth_login_success", { ip, email: result.identity.email, provider: result.provider });

  // Persist user + roles at login time so direct-bind sessions keep resolved roles
  // on subsequent requests where password is no longer available.
  const normalizedEmail = result.identity.email.trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      displayName: result.identity.displayName,
      adExternalId: result.identity.externalId,
      isActive: true
    },
    create: {
      email: normalizedEmail,
      displayName: result.identity.displayName,
      adExternalId: result.identity.externalId,
      isActive: true
    }
  });

  const baseRoles = ["VIEWER", "EDITOR", "APPROVER", "ADMIN"] as const;
  await Promise.all(
    baseRoles.map((key) =>
      prisma.role.upsert({
        where: { key },
        update: {},
        create: { key, name: key }
      })
    )
  );

  const existingRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: { role: true }
  });
  const existingRoleKeys = Array.from(new Set(existingRoles.map((item) => item.role.key)));
  const hasElevatedExistingRole = existingRoleKeys.some((role) => role === "ADMIN" || role === "APPROVER" || role === "EDITOR");

  let rolesToApply = result.roles as RoleKey[];
  const isLdapProvider = result.provider === "ldap";
  const isViewerOnly = rolesToApply.length === 1 && rolesToApply[0] === "VIEWER";

  // For LDAP logins, do not downgrade manually granted elevated roles
  // when provider resolution returns only VIEWER.
  if (isLdapProvider && isViewerOnly && hasElevatedExistingRole) {
    rolesToApply = existingRoleKeys;
  }

  const effectiveRoleRecords = await prisma.role.findMany({ where: { key: { in: rolesToApply } } });
  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.createMany({
    data: effectiveRoleRecords.map((role) => ({ userId: user.id, roleId: role.id })),
    skipDuplicates: true
  });

  const res = NextResponse.json({ ok: true, email: normalizedEmail, roles: rolesToApply, provider: result.provider });
  res.cookies.set(AUTH_COOKIE, normalizedEmail, sessionCookieOptions());
  res.cookies.set(DEMO_COOKIE, "", { ...clearCookieOptions(), maxAge: 0 });
  return res;
}
