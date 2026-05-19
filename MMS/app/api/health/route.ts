import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkAuthProviderHealth } from "@/lib/auth/provider";
import { checkEpsHealth } from "@/lib/integrations/eps-client";
import { checkWmsHealth } from "@/lib/integrations/wms-client";
import { log } from "@/lib/observability/logger";

export async function GET() {
  let database = { ok: false, message: "unreachable" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, message: "healthy" };
  } catch {
    database = { ok: false, message: "unreachable" };
  }

  const [auth, eps, wms] = await Promise.all([checkAuthProviderHealth(), checkEpsHealth(), checkWmsHealth()]);

  const ok = database.ok && auth.ok;

  if (!ok) {
    log.warn("health_check_failed", {
      database,
      auth,
      eps,
      wms
    });
  }

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        auth,
        eps,
        wms
      }
    },
    { status: ok ? 200 : 503 }
  );
}
