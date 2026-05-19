import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { updateStockItemSchema } from "@/lib/validators/schemas";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { id } = await params;
  const item = await prisma.stockItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:items:update" });
  if (rateLimited) return rateLimited;
  await requireAnyRole(["EDITOR", "ADMIN"]);

  try {
    const { id } = await params;
    const payload = updateStockItemSchema.parse(await req.json());

    const exists = await prisma.stockItem.findUnique({ where: { id } });
    if (!exists) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const updated = await prisma.stockItem.update({
      where: { id },
      data: {
        sku: payload.sku,
        name: payload.name,
        description: payload.description,
        category: payload.category,
        unit: payload.unit,
        minQuantity: payload.minQuantity,
        status: payload.status,
        supplyPolicy: payload.supplyPolicy
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return NextResponse.json({ error: first?.message || "Некорректные данные карточки." }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "SKU уже используется другой позицией." }, { status: 400 });
    }
    return NextResponse.json({ error: "Не удалось сохранить карточку позиции." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:items:delete" });
  if (rateLimited) return rateLimited;
  await requireAnyRole(["ADMIN"]);

  const { id } = await params;
  const hasMovements = await prisma.stockMovement.count({ where: { itemId: id } });
  if (hasMovements > 0) {
    const archived = await prisma.stockItem.update({ where: { id }, data: { status: "ARCHIVED" } });
    return NextResponse.json({ ok: true, archived });
  }

  await prisma.stockItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
