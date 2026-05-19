import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { equipmentCreateSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { parsePagination, parseSort } from "@/lib/pagination";
import { isEquipmentApprovalRequired } from "@/lib/settings/runtime";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { Prisma } from "@prisma/client";

const VALID_EQUIPMENT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "DECOMMISSIONED"] as const;
const VALID_LIFECYCLE_STAGES = ["PLANNED", "COMMISSIONED", "IN_OPERATION", "MAINTENANCE", "RETIRED"] as const;

function validateEnum<T extends readonly string[]>(value: string | null, validValues: T): T[number] | undefined {
  if (!value || value === "all") return undefined;
  return (validValues.includes(value as T[number]) ? value : undefined) as T[number] | undefined;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const defaultPageSize = 20;
  const pageRaw = searchParams.get("page");
  const pageSizeRaw = searchParams.get("pageSize");
  if (pageRaw && (!/^\d+$/.test(pageRaw) || Number(pageRaw) < 1)) {
    return NextResponse.json({ error: "Invalid query params: page must be >= 1 integer" }, { status: 400 });
  }
  if (pageSizeRaw && (!/^\d+$/.test(pageSizeRaw) || Number(pageSizeRaw) < 1 || Number(pageSizeRaw) > 200)) {
    return NextResponse.json({ error: "Invalid query params: pageSize must be 1..200 integer" }, { status: 400 });
  }
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const category = searchParams.get("category");
  const lifecycleStage = searchParams.get("lifecycleStage");
  const department = searchParams.get("department");
  const location = searchParams.get("location");
  const responsibleUserId = searchParams.get("responsibleUserId");
  const pagination = parsePagination(searchParams, { pageSize: defaultPageSize, maxPageSize: 200 });

  const sort = parseSort(
    searchParams,
    [
      "equipmentCode",
      "name",
      "type",
      "category",
      "model",
      "serialNumber",
      "inventoryNumber",
      "department",
      "location",
      "responsibleUserId",
      "status",
      "lifecycleStage",
      "serviceDueDate",
      "warrantyExpiration",
      "updatedAt"
    ] as const,
    "updatedAt"
  );

  const where = {
    ...(q
      ? {
          OR: [
            { equipmentCode: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { model: { contains: q, mode: "insensitive" as const } },
            { serialNumber: { contains: q, mode: "insensitive" as const } },
            { inventoryNumber: { contains: q, mode: "insensitive" as const } },
            { department: { contains: q, mode: "insensitive" as const } },
            { location: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(validateEnum(status, VALID_EQUIPMENT_STATUSES) ? { status: validateEnum(status, VALID_EQUIPMENT_STATUSES) } : {}),
    ...(type && type !== "all" ? { type } : {}),
    ...(category && category !== "all" ? { category } : {}),
    ...(validateEnum(lifecycleStage, VALID_LIFECYCLE_STAGES) ? { lifecycleStage: validateEnum(lifecycleStage, VALID_LIFECYCLE_STAGES) } : {}),
    ...(department && department !== "all" ? { department } : {}),
    ...(location && location !== "all" ? { location } : {}),
    ...(responsibleUserId && responsibleUserId !== "all" ? { responsibleUserId } : {})
  };

  try {
    const [items, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        orderBy: { [sort.sortBy]: sort.order },
        skip: pagination.skip,
        take: pagination.pageSize
      }),
      prisma.equipment.count({ where })
    ]);

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        equipmentCode: item.equipmentCode ?? null,
        name: item.name,
        type: item.type ?? null,
        category: item.category ?? null,
        model: item.model ?? null,
        serialNumber: item.serialNumber ?? null,
        inventoryNumber: item.inventoryNumber ?? null,
        department: item.department ?? null,
        location: item.location ?? null,
        status: item.status ?? null,
        lifecycleStage: item.lifecycleStage ?? null,
        updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
        version: item.currentVersion ?? null
      })),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "equipment:create" });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = equipmentCreateSchema.parse(await req.json());
  const approvalRequired = await isEquipmentApprovalRequired();
  const toDate = (value?: string) => (value ? new Date(value) : undefined);
  const sanitizedInventoryNumber = payload.inventoryNumber?.trim() || undefined;
  const customAttributes = (payload.customAttributes || {}) as Record<string, unknown>;

  if (payload.type) {
    const requiredAttributes = await prisma.equipmentTypeAttribute.findMany({
      where: { typeValue: payload.type, isActive: true, required: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
    });

    const missing = requiredAttributes.filter((attribute) => {
      const value = customAttributes[attribute.key];
      return value == null || String(value).trim() === "";
    });

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Заполните обязательные атрибуты типа оборудования: ${missing.map((item) => item.label).join(", ")}`
        },
        { status: 400 }
      );
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const equipment = await tx.equipment.create({
      data: {
        equipmentCode: payload.equipmentCode,
        name: payload.name,
        type: payload.type,
        category: payload.category,
        model: payload.model,
        serialNumber: payload.serialNumber,
        inventoryNumber: sanitizedInventoryNumber,
        department: payload.department,
        location: payload.location,
        responsibleUserId: payload.responsibleUserId,
        manufacturer: payload.manufacturer,
        supplier: payload.supplier,
        productionDate: toDate(payload.productionDate),
        deliveryDate: toDate(payload.deliveryDate),
        commissioningDate: toDate(payload.commissioningDate),
        warrantyExpiration: toDate(payload.warrantyExpiration),
        serviceDueDate: toDate(payload.serviceDueDate),
        notes: payload.notes,
        customAttributes: customAttributes as Prisma.InputJsonValue,
        status: payload.status || "DRAFT",
        lifecycleStage: payload.lifecycleStage || "COMMISSIONED"
      }
    });

    const version = await tx.equipmentVersion.create({
      data: {
        equipmentId: equipment.id,
        versionNumber: 1,
        changeSummary: payload.changeSummary || "Первичное создание оборудования",
        snapshot: equipment,
        createdById: user.id
      }
    });

    await tx.equipmentEvent.create({
      data: {
        equipmentId: equipment.id,
        eventType: "CREATED",
        title: "Оборудование создано",
        description: `${equipment.equipmentCode} создано`,
        actorId: user.id
      }
    });

    if (payload.submitForApproval && approvalRequired) {
      await tx.approvalRequest.create({
        data: {
          targetType: "EQUIPMENT_VERSION",
          targetId: version.id,
          requestedById: user.id,
          status: "PENDING",
          comments: payload.changeSummary || "Новое оборудование отправлено на согласование"
        }
      });

      await tx.equipmentEvent.create({
        data: {
          equipmentId: equipment.id,
          eventType: "APPROVAL_SUBMITTED",
          title: "Оборудование отправлено на согласование",
          description: payload.changeSummary || undefined,
          actorId: user.id
        }
      });
    } else if (!approvalRequired) {
      await tx.equipmentEvent.create({
        data: {
          equipmentId: equipment.id,
          eventType: "UPDATED",
          title: "Согласование отключено настройками",
          description: "Требование согласования оборудования отключено в настройках проекта",
          actorId: user.id
        }
      });
    }

    return equipment;
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "Equipment",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json(created, { status: 201 });
}
