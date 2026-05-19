import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { equipmentTypeAttributeUpdateSchema } from "@/lib/validators/schemas";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "equipment-type-attribute:update", limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["ADMIN"]);
  const { id } = await params;
  const payload = equipmentTypeAttributeUpdateSchema.parse(await req.json());

  const before = await prisma.equipmentTypeAttribute.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Атрибут не найден" }, { status: 404 });

  const updated = await prisma.equipmentTypeAttribute.update({
    where: { id },
    data: {
      typeValue: payload.typeValue?.trim(),
      key: payload.key?.trim().toLowerCase(),
      label: payload.label?.trim(),
      dataType: payload.dataType,
      required: payload.required,
      options: payload.options,
      isActive: payload.isActive,
      sortOrder: payload.sortOrder,
      description: payload.description?.trim()
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "EquipmentTypeAttribute",
    entityId: updated.id,
    beforeState: before,
    afterState: updated
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "equipment-type-attribute:delete", limit: 80, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["ADMIN"]);
  const { id } = await params;

  const before = await prisma.equipmentTypeAttribute.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Атрибут не найден" }, { status: 404 });

  await prisma.equipmentTypeAttribute.delete({ where: { id } });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "DELETE",
    entityType: "EquipmentTypeAttribute",
    entityId: id,
    beforeState: before
  });

  return NextResponse.json({ ok: true });
}
