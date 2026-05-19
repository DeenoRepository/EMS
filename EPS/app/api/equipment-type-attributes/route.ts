import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { equipmentTypeAttributeCreateSchema } from "@/lib/validators/schemas";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const typeValue = searchParams.get("type") || undefined;
  const includeInactive = searchParams.get("includeInactive") === "1";

  const items = await prisma.equipmentTypeAttribute.findMany({
    where: {
      ...(typeValue ? { typeValue } : {}),
      ...(includeInactive ? {} : { isActive: true })
    },
    orderBy: [{ typeValue: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "equipment-type-attribute:create", limit: 100, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["ADMIN"]);
  const payload = equipmentTypeAttributeCreateSchema.parse(await req.json());

  const created = await prisma.equipmentTypeAttribute.create({
    data: {
      typeValue: payload.typeValue.trim(),
      key: payload.key.trim().toLowerCase(),
      label: payload.label.trim(),
      dataType: payload.dataType,
      required: payload.required ?? false,
      options: payload.options || undefined,
      isActive: payload.isActive ?? true,
      sortOrder: payload.sortOrder ?? 0,
      description: payload.description?.trim()
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "EquipmentTypeAttribute",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json(created, { status: 201 });
}
