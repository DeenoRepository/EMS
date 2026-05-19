export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { getSession, hasRole } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session.roles, ["ADMIN", "EDITOR", "VIEWER"])) return fail("forbidden", 403);

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 200);
  const items = await prisma.reportRun.findMany({ orderBy: { createdAt: "desc" }, take: limit });

  return ok(items.map((x) => ({
    id: x.id.toString(),
    createdAt: x.createdAt,
    createdBy: x.createdBy,
    paramsJson: x.paramsJson
  })));
}
