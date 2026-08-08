import { NextResponse } from "next/server";
import { getRegisteredModules } from "@/lib/plugins/registry";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const modules = getRegisteredModules();
  return NextResponse.json({ modules });
}
