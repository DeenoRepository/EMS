export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { getSession } from "@/lib/server/session";
import { fail, ok } from "@/lib/http";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return fail("unauthorized", 401);
  return ok({
    id: session.id.toString(),
    login: session.login,
    displayName: session.displayName,
    roles: session.roles
  });
}
