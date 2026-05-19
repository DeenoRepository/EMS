import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { referenceValueCreateSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

function getModels() {
  return {
    referenceField: (prisma as any).referenceField as any,
    referenceValue: (prisma as any).referenceValue as any
  };
}

function referenceClientError() {
  return NextResponse.json(
    { error: "Справочник не инициализирован в Prisma Client. Выполните: npx prisma migrate deploy && npx prisma generate и перезапустите приложение." },
    { status: 500 }
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "reference-value:create", limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["ADMIN"]);
  const { referenceField, referenceValue } = getModels();
  if (!referenceField || !referenceValue) return referenceClientError();

  const { id } = await params;
  const payload = referenceValueCreateSchema.parse(await req.json());

  const field = await referenceField.findUnique({ where: { id } });
  if (!field) return NextResponse.json({ error: "Поле справочника не найдено" }, { status: 404 });

  const created = await referenceValue.create({
    data: {
      fieldId: id,
      value: payload.value,
      label: payload.label,
      isActive: payload.isActive ?? true,
      sortOrder: payload.sortOrder ?? 0
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "ReferenceValue",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json(created, { status: 201 });
}

