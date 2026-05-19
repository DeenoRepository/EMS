export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { getSession } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return fail("unauthorized", 401);
  return ok(session);
}
