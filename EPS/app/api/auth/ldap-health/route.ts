import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { checkAuthProviderHealth } from "@/lib/auth/provider";

export async function GET() {
  await requireAnyRole(["ADMIN"]);
  const result = await checkAuthProviderHealth();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
