import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { referenceFieldCreateSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

function getReferenceFieldModel() {
  const model = (prisma as any).referenceField;
  return model as any;
}

function referenceClientError() {
  return NextResponse.json(
    { error: "Справочник не инициализирован в Prisma Client. Выполните: npx prisma migrate deploy && npx prisma generate и перезапустите приложение." },
    { status: 500 }
  );
}

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const referenceField = getReferenceFieldModel();
  if (!referenceField) return referenceClientError();

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType") || "EQUIPMENT";
  const includeInactive = searchParams.get("includeInactive") === "1";

  const fields = await referenceField.findMany({
    where: {
      entityType: entityType as "EQUIPMENT",
      ...(includeInactive ? {} : { isActive: true })
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    include: {
      values: {
        where: includeInactive ? undefined : { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
      }
    }
  });

  return NextResponse.json(fields);
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "reference-field:create", limit: 80, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["ADMIN"]);
  const referenceField = getReferenceFieldModel();
  if (!referenceField) return referenceClientError();

  try {
    const body = await req.json();
    const payload = referenceFieldCreateSchema.parse(body);
    const normalizedKey = payload.key.trim().toLowerCase();

    const created = await referenceField.create({
      data: {
        entityType: payload.entityType,
        key: normalizedKey,
        label: payload.label.trim(),
        description: payload.description?.trim(),
        isActive: payload.isActive ?? true,
        sortOrder: payload.sortOrder ?? 0
      }
    });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "CREATE",
      entityType: "ReferenceField",
      entityId: created.id,
      afterState: created
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return NextResponse.json({ error: `Некорректные данные: ${first?.message || "проверьте форму"}` }, { status: 400 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Поле справочника с таким кодом уже существует. Используйте другой код или включите существующее поле." },
          { status: 409 }
        );
      }

      if (error.code === "P2021" || error.code === "P2022") {
        return NextResponse.json(
          { error: "Справочник не инициализирован в базе данных. Примените миграции Prisma и перезапустите приложение." },
          { status: 500 }
        );
      }

      return NextResponse.json({ error: `Ошибка базы данных (${error.code}): ${error.message}` }, { status: 500 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: `Ошибка сервера: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ error: "Не удалось создать поле справочника" }, { status: 500 });
  }
}
