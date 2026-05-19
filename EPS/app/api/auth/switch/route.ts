import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, DEMO_COOKIE, clearCookieOptions, demoCookieOptions } from "@/lib/auth/session";
import { checkRateLimit, enforceSameOrigin, getClientIp, rateLimitResponse } from "@/lib/security/request";
import { isDebugAuthEnabled } from "@/lib/config/features";

export async function POST(req: NextRequest) {
  if (!isDebugAuthEnabled()) {
    return NextResponse.json({ error: "Маршрут debug-аутентификации отключен" }, { status: 404 });
  }
  enforceSameOrigin(req);
  const ip = getClientIp(req);
  const limit = checkRateLimit({ key: `auth:switch:${ip}`, limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return rateLimitResponse(limit.resetInMs);

  const body = await req.json();
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "Email обязателен" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, email });
  res.cookies.set(DEMO_COOKIE, email, demoCookieOptions());
  res.cookies.set(AUTH_COOKIE, "", { ...clearCookieOptions(), maxAge: 0 });
  return res;
}

