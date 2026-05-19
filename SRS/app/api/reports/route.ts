import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
export async function GET(req: NextRequest) {
  await requireAnyRole(["ADMIN", "EDITOR", "VIEWER"]);
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 200);
  const items = await prisma.reportRun.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return NextResponse.json(items.map((x) => ({
    id: x.id.toString(),
    createdAt: x.createdAt,
    createdBy: x.createdBy,
    paramsJson: x.paramsJson
  })));
}
