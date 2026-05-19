export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { getSession, hasRole } from "@/lib/server/session";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session || !hasRole(session.roles, ["ADMIN", "EDITOR", "VIEWER"])) return fail("forbidden", 403);

  const id = BigInt(params.id);
  const report = await prisma.reportRun.findUnique({ where: { id } });
  if (!report) return fail("report not found", 404);
  return ok(report);
}
