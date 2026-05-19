import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { referenceFieldUpdateSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

function getReferenceFieldModel() {
  return (prisma as any).referenceField as any;
}

function referenceClientError() {
  return NextResponse.json(
    { error: "Справочник не инициализирован в Prisma Client. Выполните: npx prisma migrate deploy && npx prisma generate и перезапустите приложение." },
    { status: 500 }
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "reference-field:update", limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["ADMIN"]);
  const referenceField = getReferenceFieldModel();
  if (!referenceField) return referenceClientError();

  const { id } = await params;
  const payload = referenceFieldUpdateSchema.parse(await req.json());

  const before = await referenceField.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Поле справочника не найдено" }, { status: 404 });

  const updated = await referenceField.update({
    where: { id },
    data: {
      entityType: payload.entityType,
      key: payload.key,
      label: payload.label,
      description: payload.description,
      isActive: payload.isActive,
      sortOrder: payload.sortOrder
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "ReferenceField",
    entityId: updated.id,
    beforeState: before,
    afterState: updated
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "reference-field:delete", limit: 50, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["ADMIN"]);
  const referenceField = getReferenceFieldModel();
  if (!referenceField) return referenceClientError();

  const { id } = await params;

  const before = await referenceField.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Поле справочника не найдено" }, { status: 404 });

  await referenceField.delete({ where: { id } });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "DELETE",
    entityType: "ReferenceField",
    entityId: id,
    beforeState: before
  });

  return NextResponse.json({ ok: true });
}

