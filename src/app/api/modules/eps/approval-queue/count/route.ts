import { NextResponse } from "next/server";
import { getApprovalsStore } from "@/lib/modules/eps-advanced-store";

export async function GET() {
  // Динамический расчёт очереди согласований из хранилища заявок
  const approvals = getApprovalsStore();
  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;
  return NextResponse.json({ count: pendingCount, timestamp: Date.now() });
}

