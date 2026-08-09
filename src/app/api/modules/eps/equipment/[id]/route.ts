import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions, canManageEquipment } from "@/lib/auth/eps-rbac";
import { logEvent } from "@/lib/telemetry/logger";
import { z } from "zod";

// SEC-02: Strict Zod validation schema for updating equipment passports
const equipmentUpdateSchema = z.object({
  name: z.string().min(2, "Наименование должно содержать минимум 2 символа").optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  inventoryNumber: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "DECOMMISSIONED"]).optional(),
  lifecycleStage: z.enum(["PLANNED", "COMMISSIONED", "IN_OPERATION", "MAINTENANCE", "RETIRED"]).optional(),
  criticality: z.enum(["A", "B", "C"]).optional(),
  manufacturer: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  countryOfOrigin: z.string().nullable().optional(),
  isImported: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  productionDate: z.string().nullable().optional(),
  deliveryDate: z.string().nullable().optional(),
  commissioningDate: z.string().nullable().optional(),
  warrantyExpiration: z.string().nullable().optional(),
  serviceDueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  techSpecs: z.record(z.string(), z.any()).nullable().optional(),
  changeSummary: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const item = await prisma.equipment.findFirst({
      where: {
        OR: [{ id: id }, { equipmentCode: id }]
      }
    });

    if (item) {
      return NextResponse.json({ item });
    }

    return NextResponse.json({ error: "Оборудование не найдено" }, { status: 404 });
  } catch (err) {
    console.error("EPS Equipment GET failed:", err);
    return NextResponse.json({ error: "Ошибка базы данных при получении оборудования" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const permissions = await getUserEpsPermissions();
  if (!permissions.canEdit) {
    return NextResponse.json(
      { error: "Отказано в доступе. Редактирование паспорта оборудования доступно только редакторам и администраторам." },
      { status: 403 }
    );
  }

  const { id } = await params;

  // 1. Поиск существующего оборудования
  const existing = await prisma.equipment.findFirst({
    where: {
      OR: [{ id: id }, { equipmentCode: id }]
    }
  });

  if (!existing) {
    return NextResponse.json({ error: "Оборудование не найдено" }, { status: 404 });
  }

  // SEC-01: Proactive RBAC check for equipment responsibility
  const canManage = await canManageEquipment(existing.id);
  if (!canManage) {
    return NextResponse.json(
      { error: "Отказано в доступе. Вы не являетесь ответственным лицом или назначенным администратором для данного оборудования." },
      { status: 403 }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный формат JSON тела запроса" }, { status: 400 });
  }

  // SEC-02: Zod validation
  const validation = equipmentUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Некорректные данные запроса", details: validation.error.format() },
      { status: 400 }
    );
  }

  const data = validation.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Создаем историческую версию оборудования со снапшотом текущего состояния
      await tx.equipmentVersion.create({
        data: {
          equipmentId: existing.id,
          versionNumber: existing.currentVersion,
          changeSummary: data.changeSummary || `Обновление паспорта оборудования (v${existing.currentVersion + 1})`,
          snapshot: JSON.parse(JSON.stringify(existing)),
          createdById: session.id
        }
      });

      // 2. Обновляем паспорт оборудования и увеличиваем номер версии
      const updated = await tx.equipment.update({
        where: { id: existing.id },
        data: {
          name: data.name ?? existing.name,
          category: data.category ?? existing.category,
          type: data.type ?? existing.type,
          model: data.model ?? existing.model,
          serialNumber: data.serialNumber ?? existing.serialNumber,
          inventoryNumber: data.inventoryNumber ?? existing.inventoryNumber,
          department: data.department ?? existing.department,
          location: data.location ?? existing.location,
          status: data.status ?? existing.status,
          criticality: data.criticality ?? (existing as Record<string, unknown>).criticality,
          manufacturer: data.manufacturer ?? existing.manufacturer,
          supplier: data.supplier ?? existing.supplier,
          countryOfOrigin: data.countryOfOrigin ?? (existing as Record<string, unknown>).countryOfOrigin,
          isImported: data.isImported ?? (existing as Record<string, unknown>).isImported,
          isUnique: data.isUnique ?? (existing as Record<string, unknown>).isUnique,
          productionDate: data.productionDate ?? existing.productionDate,
          deliveryDate: data.deliveryDate ?? existing.deliveryDate,
          commissioningDate: data.commissioningDate ?? existing.commissioningDate,
          warrantyExpiration: data.warrantyExpiration ?? existing.warrantyExpiration,
          serviceDueDate: data.serviceDueDate ?? existing.serviceDueDate,
          notes: data.notes ?? existing.notes,
          techSpecs: data.techSpecs ?? (existing as Record<string, unknown>).techSpecs,
          currentVersion: existing.currentVersion + 1,
        } as unknown as Prisma.EquipmentUpdateInput
      });

      return updated;
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "EQUIPMENT_UPDATED",
      userId: session.id,
      userEmail: session.email,
      details: { equipmentId: existing.id, newVersion: result.currentVersion }
    });

    return NextResponse.json({ success: true, item: result });
  } catch (err) {
    console.error("EPS Equipment update failed:", err);
    return NextResponse.json({ error: "Ошибка базы данных при обновлении паспорта" }, { status: 500 });
  }
}

// LOG-04: Soft Delete / Safe Decommissioning endpoint
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const permissions = await getUserEpsPermissions();
  if (!permissions.isUnrestricted) {
    return NextResponse.json(
      { error: "Отказано в доступе. Вывод оборудования из эксплуатации доступен только администраторам." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.equipment.findFirst({
      where: { OR: [{ id }, { equipmentCode: id }] }
    });

    if (!existing) {
      return NextResponse.json({ error: "Оборудование не найдено" }, { status: 404 });
    }

    const decommissioned = await prisma.$transaction(async (tx) => {
      // 1. Создаем архивную версию перед выводом из эксплуатации
      await tx.equipmentVersion.create({
        data: {
          equipmentId: existing.id,
          versionNumber: existing.currentVersion,
          changeSummary: "Архивация паспорта оборудования перед выводом из эксплуатации",
          snapshot: JSON.parse(JSON.stringify(existing)),
          createdById: session.id
        }
      });

      // 2. Переводим статус оборудования в DECOMMISSIONED и lifecycleStage в RETIRED
      const updated = await tx.equipment.update({
        where: { id: existing.id },
        data: {
          status: "DECOMMISSIONED",
          lifecycleStage: "RETIRED",
          currentVersion: existing.currentVersion + 1
        }
      });

      return updated;
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "EQUIPMENT_DECOMMISSIONED",
      userId: session.id,
      userEmail: session.email,
      details: { equipmentId: existing.id, code: existing.equipmentCode }
    });

    return NextResponse.json({
      success: true,
      message: "Оборудование успешно выведено из эксплуатации и переведено в архив",
      item: decommissioned
    });
  } catch (err) {
    console.error("EPS Equipment DELETE error:", err);
    return NextResponse.json({ error: "Ошибка базы данных при списании оборудования" }, { status: 500 });
  }
}
