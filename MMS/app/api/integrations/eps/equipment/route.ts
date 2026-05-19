import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { fetchEquipmentList } from "@/lib/integrations/eps-client";

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const page = Number(searchParams.get("page") || 1);
  const pageSize = Number(searchParams.get("pageSize") || 20);

  try {
    const data = await fetchEquipmentList({ q, page, pageSize });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Не удалось получить данные оборудования из EPS",
        details: error instanceof Error ? error.message : "unknown error"
      },
      { status: 502 }
    );
  }
}
