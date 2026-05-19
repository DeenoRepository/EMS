import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";

function getReferenceFieldModel() {
  return (prisma as any).referenceField as any;
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

  const fields = await referenceField.findMany({
    where: {
      entityType: entityType as "EQUIPMENT",
      isActive: true
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    include: {
      values: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
      }
    }
  });

  const options: Record<string, Array<{ id: string; value: string; label: string }>> = {};
  for (const field of fields as Array<{ key: string; values: Array<{ id: string; value: string; label: string }> }>) {
    options[field.key] = field.values.map((item) => ({ id: item.id, value: item.value, label: item.label }));
  }

  return NextResponse.json({ options, fields });
}
