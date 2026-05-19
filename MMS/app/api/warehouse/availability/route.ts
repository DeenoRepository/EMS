import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { warehouseAvailabilitySchema } from "@/lib/validators/schemas";
import { fetchWmsAvailability } from "@/lib/integrations/wms-client";

export async function POST(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const payload = warehouseAvailabilitySchema.parse(await req.json());

  try {
    const response = await fetchWmsAvailability(payload.equipmentId, payload.items);
    return NextResponse.json({ ...response, stub: false, source: "wms-api" });
  } catch (error) {
    // Fallback keeps MMS usable when WMS integration is temporarily unavailable.
    return NextResponse.json({
      ok: true,
      stub: true,
      source: "wms-fallback",
      warning: error instanceof Error ? error.message : "WMS unavailable",
      equipmentId: payload.equipmentId,
      items: payload.items.map((item, index) => ({
        sku: item.sku,
        requested: item.quantity,
        available: index % 2 === 0 ? item.quantity : Math.max(0, item.quantity - 1),
        status: index % 2 === 0 ? "AVAILABLE" : "PARTIAL"
      }))
    });
  }
}
