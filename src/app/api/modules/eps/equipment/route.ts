import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma, EquipmentStatus } from "@prisma/client";

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
  } catch {
    // Резервный фолбэк при отсутствии поднятой БД для локальной разработки
    return NextResponse.json({
      items: [
        {
          id: "eq-001",
          equipmentCode: "EQ-CNC-2026-01",
          name: "Фрезерный станок с ЧПУ HAAS VF-2",
          type: "Обрабатывающий центр",
          category: "Металлообработка",
          model: "VF-2SS",
          serialNumber: "SN-9948271",
          inventoryNumber: "INV-440192",
          department: "Цех №3",
          location: "Участок ЧПУ, поз. 14",
          status: "ACTIVE",
          lifecycleStage: "IN_OPERATION",
          currentVersion: 1,
          updatedAt: new Date().toISOString()
        }
      ],
      total: 1
    });
  }
}

export async function POST(request: Request) {
  try {
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
        responsibleUser: body.responsibleUser,
        techSpecs: body.techSpecs,
        lifecycleStage: body.lifecycleStage || "IN_OPERATION",
        currentVersion: 1
      } as any
    });

    return NextResponse.json({ success: true, item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка создания паспорта оборудования" }, { status: 400 });
  }
}
