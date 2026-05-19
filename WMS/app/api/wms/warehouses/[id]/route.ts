import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { updateWarehouseSchema } from "@/lib/validators/schemas";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { id } = await params;
  const item = await prisma.warehouse.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:warehouses:update" });
  if (rateLimited) return rateLimited;
  await requireAnyRole(["EDITOR", "ADMIN"]);
  try {
    const { id } = await params;
    const payload = updateWarehouseSchema.parse(await req.json());

    const exists = await prisma.warehouse.findUnique({ where: { id } });
    if (!exists) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      if (payload.type === "PRIMARY") {
        await tx.warehouse.updateMany({
          where: { type: "PRIMARY", id: { not: id } },
          data: { type: "AUXILIARY" }
        });
      }
      return tx.warehouse.update({
        where: { id },
        data: {
          name: payload.name,
          code: payload.code,
          description: payload.description,
          responsibleEmail: payload.responsibleEmail || null,
          status: payload.status,
          type: payload.type
        }
      });
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues[0]?.message ?? "Некорректные данные склада";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Код склада уже используется." }, { status: 400 });
    }
    console.error("[WMS][WAREHOUSE_PUT]", error);
    return NextResponse.json({ error: "Не удалось сохранить склад" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:warehouses:delete" });
  if (rateLimited) return rateLimited;
  await requireAnyRole(["ADMIN"]);

  const { id } = await params;
  const balanceCount = await prisma.stockBalance.count({ where: { warehouseId: id } });
  if (balanceCount > 0) {
    return NextResponse.json({ error: "Warehouse has balances and cannot be deleted" }, { status: 400 });
  }

  await prisma.warehouse.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
