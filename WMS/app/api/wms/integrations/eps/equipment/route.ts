import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { searchEpsEquipment } from "@/lib/integrations/eps-client";

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ items: [] });

  try {
    const items = await searchEpsEquipment(q);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
