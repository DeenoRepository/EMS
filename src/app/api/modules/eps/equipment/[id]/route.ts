import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { MOCK_EQUIPMENT_DATA } from "@/lib/modules/eps-store";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";

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
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный формат JSON тела запроса" }, { status: 400 });
  }

  try {
    const existing = await prisma.equipment.findFirst({
      where: {
        OR: [{ id: id }, { equipmentCode: id }]
      }
    });

    if (existing) {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Создаем историческую версию оборудования со снапшотом текущего состояния
        await tx.equipmentVersion.create({
          data: {
            equipmentId: existing.id,
            versionNumber: existing.currentVersion,
            changeSummary: body.changeSummary || `Обновление паспорта оборудования (v${existing.currentVersion + 1})`,
            snapshot: JSON.parse(JSON.stringify(existing)),
            createdById: session.id
          }
        });

        // 2. Обновляем паспорт оборудования и увеличиваем номер версии
        const updated = await tx.equipment.update({
          where: { id: existing.id },
          data: {
            name: body.name ?? existing.name,
            category: body.category ?? existing.category,
            type: body.type ?? existing.type,
            model: body.model ?? existing.model,
            serialNumber: body.serialNumber ?? existing.serialNumber,
            inventoryNumber: body.inventoryNumber ?? existing.inventoryNumber,
            department: body.department ?? existing.department,
            location: body.location ?? existing.location,
            status: body.status ?? existing.status,
            criticality: body.criticality ?? (existing as Record<string, unknown>).criticality,
            manufacturer: body.manufacturer ?? existing.manufacturer,
            supplier: body.supplier ?? existing.supplier,
            countryOfOrigin: body.countryOfOrigin ?? (existing as Record<string, unknown>).countryOfOrigin,
            isImported: body.isImported ?? (existing as Record<string, unknown>).isImported,
            isUnique: body.isUnique ?? (existing as Record<string, unknown>).isUnique,
            productionDate: body.productionDate ?? existing.productionDate,
            deliveryDate: body.deliveryDate ?? existing.deliveryDate,
            commissioningDate: body.commissioningDate ?? existing.commissioningDate,
            warrantyExpiration: body.warrantyExpiration ?? existing.warrantyExpiration,
            serviceDueDate: body.serviceDueDate ?? existing.serviceDueDate,
            notes: body.notes ?? existing.notes,
            techSpecs: body.techSpecs ?? (existing as Record<string, unknown>).techSpecs,
            currentVersion: existing.currentVersion + 1,
          } as unknown as Prisma.EquipmentUpdateInput
        });

        return updated;
      });

      return NextResponse.json({ success: true, item: result });
    }

    return NextResponse.json({ error: "Оборудование не найдено" }, { status: 404 });
  } catch (err) {
    console.error("EPS Equipment update failed:", err);
    return NextResponse.json({ error: "Ошибка базы данных при обновлении паспорта" }, { status: 500 });
  }
}

