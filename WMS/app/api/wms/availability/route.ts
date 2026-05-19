import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { isIntegrationAuthorized } from "@/lib/security/integration-auth";

const availabilitySchema = z.object({
  equipmentId: z.string().min(1),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().positive()
      })
    )
    .min(1)
});

export async function POST(req: NextRequest) {
  const serviceTokenOk = isIntegrationAuthorized(req);
  if (!serviceTokenOk) {
    try {
      await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const parsed = availabilitySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    const skuList = Array.from(new Set(parsed.data.items.map((item) => item.sku.trim())));
    const stockItems = await prisma.stockItem.findMany({
      where: { sku: { in: skuList } },
      include: {
        balances: true
      }
    });

    const bySku = new Map(stockItems.map((item) => [item.sku, item]));
    const items = parsed.data.items.map((reqItem) => {
      const found = bySku.get(reqItem.sku.trim());
      const available = found
        ? found.balances.reduce((sum, row) => sum + Number(row.quantity.toString()) - Number(row.reservedQuantity.toString()), 0)
        : 0;

      const requested = reqItem.quantity;
      const status = available >= requested ? "AVAILABLE" : available > 0 ? "PARTIAL" : "UNAVAILABLE";

      return {
        sku: reqItem.sku,
        requested,
        available,
        status
      };
    });

    return NextResponse.json({
      ok: true,
      items
    });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
