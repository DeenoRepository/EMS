import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkAuthProviderHealth } from "@/lib/auth/provider";
import { checkStorageHealth } from "@/lib/storage/health";
import { log } from "@/lib/observability/logger";

export async function GET() {
  let database = { ok: false, message: "unreachable" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, message: "healthy" };
  } catch {
    database = { ok: false, message: "unreachable" };
  }

  const [auth, storage] = await Promise.all([checkAuthProviderHealth(), checkStorageHealth()]);

  const ok = database.ok && auth.ok && storage.ok;

  if (!ok) {
    log.warn("health_check_failed", {
      database,
      auth,
      storage
    });
  }

  return NextResponse.json({
    ok,
    timestamp: new Date().toISOString(),
    checks: {
      database,
      auth,
      storage
    }
  });
}
