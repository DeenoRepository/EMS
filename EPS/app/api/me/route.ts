import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";

export async function GET() {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  return NextResponse.json(user);
}
