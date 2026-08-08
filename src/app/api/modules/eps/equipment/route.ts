import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma, EquipmentStatus } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const status = searchParams.get("status");

  try {
    const whereCondition: Prisma.EquipmentWhereInput = {};

    if (query) {
      whereCondition.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { equipmentCode: { contains: query, mode: "insensitive" } },
        { inventoryNumber: { contains: query, mode: "insensitive" } }
      ];
    }

    if (status) {
      whereCondition.status = status as EquipmentStatus;
    }

    const items = await prisma.equipment.findMany({
      where: whereCondition,
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    console.error("EPS Equipment list query failed:", err);
    return NextResponse.json({ items: [], total: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const permissions = await getUserEpsPermissions();
    if (!permissions.canEdit) {
      return NextResponse.json(
        { error: "Отказано в доступе. Создание паспорта оборудования доступно только редакторам и администраторам." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const created = await prisma.equipment.create({
      data: {
        equipmentCode: body.equipmentCode || `EQ-${Date.now()}`,
        name: body.name,
        type: body.type || "Промышленное оборудование",
        category: body.category || "Общее",
        model: body.model || "Стандарт",
        serialNumber: body.serialNumber || "-",
        inventoryNumber: body.inventoryNumber || `INV-${Date.now()}`,
        department: body.department || "Главный цех",
        location: body.location || "Участок 1",
        status: body.status || "ACTIVE",
        criticality: body.criticality || "A",
        manufacturer: body.manufacturer,
        supplier: body.supplier,
        countryOfOrigin: body.countryOfOrigin,
        isImported: body.isImported ?? false,
        isUnique: body.isUnique ?? false,
        productionDate: body.productionDate,
        deliveryDate: body.deliveryDate,
        commissioningDate: body.commissioningDate,
        warrantyExpiration: body.warrantyExpiration,
        serviceDueDate: body.serviceDueDate,
        notes: body.notes,
        responsibleUserId: body.responsibleUserId || session.id,
        techSpecs: body.techSpecs,
        lifecycleStage: body.lifecycleStage || "IN_OPERATION",
        currentVersion: 1
      } as unknown as Prisma.EquipmentCreateInput
    });

    return NextResponse.json({ success: true, item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка создания паспорта оборудования" }, { status: 400 });
  }
}
