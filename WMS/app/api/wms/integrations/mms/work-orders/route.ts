import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { mmsApiClient } from "@/lib/integrations/mms-api-client";

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const q = new URL(req.url).searchParams.get("q") || "";
  if (!q.trim()) return NextResponse.json({ items: [] });

  try {
    const data = await mmsApiClient.searchWorkOrders(q.trim());
    const items = Array.isArray((data as any)?.items) ? (data as any).items : Array.isArray(data) ? data : [];
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

