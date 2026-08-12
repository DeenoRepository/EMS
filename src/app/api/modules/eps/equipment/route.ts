import { prisma } from "@/lib/db/prisma";
import { Prisma, EquipmentStatus } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions } from "@/lib/auth/eps-rbac";
import { logEvent } from "@/lib/telemetry/logger";
import { ShellEventBus } from "@/lib/shell/event-bus";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
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

const equipmentQuerySchema = z.object({
  query: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "DECOMMISSIONED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/modules/eps/equipment
 *
 * Получить список оборудования с фильтрацией и пагинацией.
 *
 * @requires Permission: eps.equipment.read
 * @returns {Promise<{ items: Equipment[], total: number, limit: number, offset: number }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { searchParams } = new URL(request.url);
  const parseResult = equipmentQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Некорректные параметры запроса",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { query, status, limit, offset } = parseResult.data;

  try {
    const whereCondition: Prisma.EquipmentWhereInput = {};

    if (query) {
      whereCondition.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { equipmentCode: { contains: query, mode: "insensitive" } },
        { inventoryNumber: { contains: query, mode: "insensitive" } },
      ];
    }

    if (status) {
      whereCondition.status = status as EquipmentStatus;
    }

    const [items, total] = await Promise.all([
      prisma.equipment.findMany({
        where: whereCondition,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.equipment.count({ where: whereCondition }),
    ]);

    return createSuccessResponse({ items, total, limit, offset }, request);
  } catch (err) {
    console.error("EPS Equipment list query failed:", err);
    logEvent({
      level: "error",
      module: "EPS",
      action: "EQUIPMENT_LIST_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка получения списка оборудования",
      undefined,
      500,
      request
    );
  }
}

/**
 * POST /api/modules/eps/equipment
 *
 * Создать новый паспорт оборудования с начальной версией.
 *
 * @requires Permission: eps.equipment.create
 * @returns {Promise<{ success: true, item: Equipment }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    const permissions = await getUserEpsPermissions();
    if (!permissions.canEdit) {
      logEvent({
        level: "warn",
        module: "EPS",
        action: "EQUIPMENT_CREATE_DENIED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Создание паспорта оборудования доступно только редакторам и администраторам.",
        undefined,
        403,
        request
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(
        "INVALID_JSON",
        "Неверный формат JSON в теле запроса",
        undefined,
        400,
        request
      );
    }

    // SEC-02: Zod validation
    const validation = equipmentCreateSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные данные создания паспорта",
        validation.error.format(),
        400,
        request
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
          currentVersion: 1,
        } as unknown as Prisma.EquipmentCreateInput,
      });

      await tx.equipmentVersion.create({
        data: {
          equipmentId: eq.id,
          versionNumber: 1,
          changeSummary: "Первичная паспортизация единицы оборудования",
          snapshot: JSON.parse(JSON.stringify(eq)),
          createdById: session.id,
        },
      });

      return eq;
    });

    // Audit log
    logEvent({
      level: "audit",
      module: "EPS",
      action: "EQUIPMENT_CREATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        equipmentId: created.id,
        code: created.equipmentCode,
        name: created.name,
      },
    });

    // Domain event publication
    await ShellEventBus.publish(
      "eps.equipment.created",
      "EPS",
      {
        equipmentId: created.id,
        equipmentCode: created.equipmentCode,
        name: created.name,
        type: created.type,
        category: created.category,
        performedBy: session.id,
        performedByEmail: session.email,
      },
      correlationId
    );

    return createSuccessResponse({ success: true, item: created }, request, 201);
  } catch (err) {
    console.error("EPS Equipment creation failed:", err);
    logEvent({
      level: "error",
      module: "EPS",
      action: "EQUIPMENT_CREATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка создания паспорта оборудования",
      undefined,
      500,
      request
    );
  }
}
