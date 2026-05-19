import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ready: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, ready: false }, { status: 503 });
  }
}
