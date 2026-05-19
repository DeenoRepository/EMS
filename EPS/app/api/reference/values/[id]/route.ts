import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { referenceValueUpdateSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

function getReferenceValueModel() {
  return (prisma as any).referenceValue as any;
}

function referenceClientError() {
  return NextResponse.json(
    { error: "Справочник не инициализирован в Prisma Client. Выполните: npx prisma migrate deploy && npx prisma generate и перезапустите приложение." },
    { status: 500 }
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "reference-value:update", limit: 160, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["ADMIN"]);
  const referenceValue = getReferenceValueModel();
  if (!referenceValue) return referenceClientError();

  const { id } = await params;
  const payload = referenceValueUpdateSchema.parse(await req.json());

  const before = await referenceValue.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Значение справочника не найдено" }, { status: 404 });

  const updated = await referenceValue.update({
    where: { id },
    data: {
      value: payload.value,
      label: payload.label,
      isActive: payload.isActive,
      sortOrder: payload.sortOrder
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "ReferenceValue",
    entityId: updated.id,
    beforeState: before,
    afterState: updated
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "reference-value:delete", limit: 100, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["ADMIN"]);
  const referenceValue = getReferenceValueModel();
  if (!referenceValue) return referenceClientError();

  const { id } = await params;

  const before = await referenceValue.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Значение справочника не найдено" }, { status: 404 });

  await referenceValue.delete({ where: { id } });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "DELETE",
    entityType: "ReferenceValue",
    entityId: id,
    beforeState: before
  });

  return NextResponse.json({ ok: true });
}

