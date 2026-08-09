import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions, canManageEquipment } from "@/lib/auth/eps-rbac";
import { logEvent } from "@/lib/telemetry/logger";

export async function POST(
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
      { error: "Отказано в доступе. Откат версий доступен только редакторам и администраторам." },
      { status: 403 }
    );
  }

  const { id } = await params;

  let body: { targetVersion?: number } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный формат JSON в теле запроса" }, { status: 400 });
  }

  const targetVersionNumber = body.targetVersion;
  if (!targetVersionNumber || typeof targetVersionNumber !== "number") {
    return NextResponse.json(
      { error: "Необходимо указать целевой номер версии в поле targetVersion" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.equipment.findFirst({
      where: { OR: [{ id }, { equipmentCode: id }] }
    });

    if (!existing) {
      return NextResponse.json({ error: "Оборудование не найдено" }, { status: 404 });
    }

    // SEC-01: Proactive RBAC check
    const canManage = await canManageEquipment(existing.id);
    if (!canManage) {
      return NextResponse.json(
        { error: "Отказано в доступе. Вы не являетесь ответственным лицом для данного оборудования." },
        { status: 403 }
      );
    }

    const targetVersionRecord = await prisma.equipmentVersion.findFirst({
      where: {
        equipmentId: existing.id,
        versionNumber: targetVersionNumber
      }
    });

    if (!targetVersionRecord) {
      return NextResponse.json(
        { error: `Версия v${targetVersionNumber} не найдена в истории данного оборудования` },
        { status: 404 }
      );
    }

    const snapshot = targetVersionRecord.snapshot as Record<string, any>;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Сохраняем перед откатом текущее состояние как отдельную историческую версию
      await tx.equipmentVersion.create({
        data: {
          equipmentId: existing.id,
          versionNumber: existing.currentVersion,
          changeSummary: `Автоматическое сохранение перед откатом к версии v${targetVersionNumber}`,
          snapshot: JSON.parse(JSON.stringify(existing)),
          createdById: session.id
        }
      });

      // 2. Обновляем паспорт оборудования данными из выбранного снапшота
      const restored = await tx.equipment.update({
        where: { id: existing.id },
        data: {
          name: snapshot.name ?? existing.name,
          type: snapshot.type ?? existing.type,
          category: snapshot.category ?? existing.category,
          model: snapshot.model ?? existing.model,
          serialNumber: snapshot.serialNumber ?? existing.serialNumber,
          inventoryNumber: snapshot.inventoryNumber ?? existing.inventoryNumber,
          department: snapshot.department ?? existing.department,
          location: snapshot.location ?? existing.location,
          status: snapshot.status ?? existing.status,
          criticality: snapshot.criticality ?? (existing as any).criticality,
          manufacturer: snapshot.manufacturer ?? existing.manufacturer,
          supplier: snapshot.supplier ?? existing.supplier,
          countryOfOrigin: snapshot.countryOfOrigin ?? (existing as any).countryOfOrigin,
          isImported: snapshot.isImported ?? (existing as any).isImported,
          isUnique: snapshot.isUnique ?? (existing as any).isUnique,
          productionDate: snapshot.productionDate ?? existing.productionDate,
          deliveryDate: snapshot.deliveryDate ?? existing.deliveryDate,
          commissioningDate: snapshot.commissioningDate ?? existing.commissioningDate,
          warrantyExpiration: snapshot.warrantyExpiration ?? existing.warrantyExpiration,
          serviceDueDate: snapshot.serviceDueDate ?? existing.serviceDueDate,
          notes: `[Откат к v${targetVersionNumber}] ${snapshot.notes || ""}`,
          techSpecs: snapshot.techSpecs ?? (existing as any).techSpecs,
          currentVersion: existing.currentVersion + 1
        } as any
      });

      return restored;
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "EQUIPMENT_ROLLBACK",
      userId: session.id,
      userEmail: session.email,
      details: { equipmentId: existing.id, restoredFromVersion: targetVersionNumber, newVersion: updated.currentVersion }
    });

    return NextResponse.json({
      success: true,
      message: `Паспорт успешно откачен к состоянию версии v${targetVersionNumber}`,
      item: updated
    });
  } catch (err) {
    console.error("EPS Equipment Rollback failed:", err);
    return NextResponse.json({ error: "Ошибка базы данных при выполнении отката версии" }, { status: 500 });
  }
}
