export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let database = { ok: false, message: "unreachable" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, message: "healthy" };
  } catch {
    database = { ok: false, message: "unreachable" };
  }

  return NextResponse.json(
    {
      ok: database.ok,
      timestamp: new Date().toISOString(),
      checks: { database }
    },
    { status: database.ok ? 200 : 503 }
  );
}
