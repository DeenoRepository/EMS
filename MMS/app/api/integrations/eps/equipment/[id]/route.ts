import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { fetchEquipmentById } from "@/lib/integrations/eps-client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { id } = await params;

  try {
    const data = await fetchEquipmentById(id);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Не удалось получить карточку оборудования из EPS",
        details: error instanceof Error ? error.message : "unknown error"
      },
      { status: 502 }
    );
  }
}
