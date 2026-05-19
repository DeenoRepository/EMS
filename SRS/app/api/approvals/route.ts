import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";

export async function GET() {
  await requireAnyRole(["ADMIN", "EDITOR", "VIEWER"]);
  return NextResponse.json({ items: [] });
}
