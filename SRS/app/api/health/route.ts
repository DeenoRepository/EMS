import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkAuthProviderHealth } from "@/lib/auth/provider";
import { log } from "@/lib/observability/logger";

export async function GET() {
  let database = { ok: false, message: "unreachable" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, message: "healthy" };
  } catch {
    database = { ok: false, message: "unreachable" };
  }

  const auth = await checkAuthProviderHealth();

  const ok = database.ok && auth.ok;

  if (!ok) {
    log.warn("health_check_failed", {
      database,
      auth
    });
  }

  return NextResponse.json({
    ok,
    timestamp: new Date().toISOString(),
    checks: {
      database,
      auth
    }
  });
}
