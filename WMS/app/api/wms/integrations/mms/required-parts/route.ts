import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { mmsApiClient } from "@/lib/integrations/mms-api-client";

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const searchParams = new URL(req.url).searchParams;
  const workOrderId = searchParams.get("workOrderId") || "";
  const q = searchParams.get("q") || "";
  if (!workOrderId.trim()) return NextResponse.json({ items: [] });

  try {
    const data = await mmsApiClient.searchRequiredParts(workOrderId.trim(), q.trim());
    const items = Array.isArray((data as any)?.items) ? (data as any).items : Array.isArray(data) ? data : [];
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

