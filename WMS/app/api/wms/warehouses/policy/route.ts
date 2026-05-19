import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { getWarehousePolicy } from "@/lib/wms/warehouse-policy";

export async function GET(_req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const policy = await getWarehousePolicy(prisma);
  return NextResponse.json(policy);
}

