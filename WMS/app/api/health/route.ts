import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkAuthProviderHealth } from "@/lib/auth/provider";
import { checkEpsHealth } from "@/lib/integrations/eps-client";
import { log } from "@/lib/observability/logger";

async function checkMmsHealth() {
  const baseUrl = process.env.MMS_API_BASE_URL || "http://mms-service/api";
  const url = `${baseUrl}/health`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    return { ok: res.ok, status: res.status, url };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      message: error instanceof Error ? error.message : "MMS unavailable"
    };
  }
}

export async function GET() {
  let database = { ok: false, message: "unreachable" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, message: "healthy" };
  } catch {
    database = { ok: false, message: "unreachable" };
  }

  const [auth, eps, mms] = await Promise.all([checkAuthProviderHealth(), checkEpsHealth(), checkMmsHealth()]);
  const ok = database.ok && auth.ok;

  if (!ok) {
    log.warn("health_check_failed", { database, auth, eps, mms });
  }

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      checks: { database, auth, eps, mms }
    },
    { status: ok ? 200 : 503 }
  );
}
