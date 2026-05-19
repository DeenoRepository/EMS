import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";

export async function GET() {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "ADMIN"]);
  return NextResponse.json(user);
}
