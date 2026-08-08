import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { MOCK_EQUIPMENT_DATA } from "@/lib/modules/eps-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
  } catch {
    // Prisma fallback
  }

  const mockItem = MOCK_EQUIPMENT_DATA.find((eq) => eq.id === id || eq.equipmentCode === id);

  if (!mockItem) {
    return NextResponse.json({ error: "Оборудование не найдено" }, { status: 404 });
  }

  return NextResponse.json({ item: mockItem });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    const existing = await prisma.equipment.findFirst({
      where: {
        OR: [{ id: id }, { equipmentCode: id }]
      }
    });

    if (existing) {
      const updated = await prisma.equipment.update({
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
      return NextResponse.json({ success: true, item: updated });
    }
    return NextResponse.json({ error: "Оборудование не найдено" }, { status: 404 });
  } catch (err) {
    console.error("EPS Equipment update failed:", err);
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: " Ошибка базы данных при обновлении паспорта" }, { status: 500 });
    }
  }

  const index = MOCK_EQUIPMENT_DATA.findIndex((eq) => eq.id === id || eq.equipmentCode === id);

  if (index === -1) {
    return NextResponse.json({ error: "Оборудование не найдено" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const updated = {
      ...MOCK_EQUIPMENT_DATA[index],
      ...body,
      version: MOCK_EQUIPMENT_DATA[index].version + 1,
      updatedAt: new Date().toISOString()
    };

    MOCK_EQUIPMENT_DATA[index] = updated;

    return NextResponse.json({ success: true, item: updated });
  } catch {
    return NextResponse.json({ error: "Ошибка обновления паспорта" }, { status: 400 });
  }
}

