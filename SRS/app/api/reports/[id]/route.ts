import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["ADMIN", "EDITOR", "VIEWER"]);
  const { id } = await params;
  const report = await prisma.reportRun.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "report not found" }, { status: 404 });
  return NextResponse.json(report);
}
