import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma, EquipmentStatus } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";
import { logEvent } from "@/lib/telemetry/logger";
import { z } from "zod";

// SEC-02: Zod schema for creating equipment passport
const equipmentCreateSchema = z.object({
  equipmentCode: z.string().optional(),
  name: z.string().min(2, "Наименование должно содержать минимум 2 символа"),
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
  responsibleUserId: z.string().optional(),
  techSpecs: z.record(z.string(), z.any()).nullable().optional(),
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

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

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Неверный формат JSON в теле запроса" }, { status: 400 });
    }

    // SEC-02: Zod validation
    const validation = equipmentCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Некорректные данные создания паспорта", details: validation.error.format() },
        { status: 400 }
      );
    }

    const data = validation.data;

    const created = await prisma.$transaction(async (tx) => {
      const eq = await tx.equipment.create({
        data: {
          equipmentCode: data.equipmentCode || `EQ-${Date.now()}`,
          name: data.name,
          type: data.type || "Промышленное оборудование",
          category: data.category || "Общее",
          model: data.model || "Стандарт",
          serialNumber: data.serialNumber || "-",
          inventoryNumber: data.inventoryNumber || `INV-${Date.now()}`,
          department: data.department || "Главный цех",
          location: data.location || "Участок 1",
          status: data.status || "ACTIVE",
          criticality: data.criticality || "A",
          manufacturer: data.manufacturer,
          supplier: data.supplier,
          countryOfOrigin: data.countryOfOrigin,
          isImported: data.isImported ?? false,
          isUnique: data.isUnique ?? false,
          productionDate: data.productionDate,
          deliveryDate: data.deliveryDate,
          commissioningDate: data.commissioningDate,
          warrantyExpiration: data.warrantyExpiration,
          serviceDueDate: data.serviceDueDate,
          notes: data.notes,
          responsibleUserId: data.responsibleUserId || session.id,
          techSpecs: data.techSpecs,
          lifecycleStage: data.lifecycleStage || "IN_OPERATION",
          currentVersion: 1
        } as unknown as Prisma.EquipmentCreateInput
      });

      await tx.equipmentVersion.create({
        data: {
          equipmentId: eq.id,
          versionNumber: 1,
          changeSummary: "Первичная паспортизация единицы оборудования",
          snapshot: JSON.parse(JSON.stringify(eq)),
          createdById: session.id
        }
      });

      return eq;
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "EQUIPMENT_CREATED",
      userId: session.id,
      userEmail: session.email,
      details: { equipmentId: created.id, code: created.equipmentCode }
    });

    return NextResponse.json({ success: true, item: created }, { status: 201 });
  } catch (err) {
    console.error("EPS Equipment creation failed:", err);
    return NextResponse.json({ error: "Ошибка создания паспорта оборудования" }, { status: 400 });
  }
}
