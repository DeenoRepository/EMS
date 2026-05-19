import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, DEMO_COOKIE, clearCookieOptions } from "@/lib/auth/session";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "auth:logout", limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { ...clearCookieOptions(), maxAge: 0 });
  res.cookies.set(DEMO_COOKIE, "", { ...clearCookieOptions(), maxAge: 0 });
  return res;
}


