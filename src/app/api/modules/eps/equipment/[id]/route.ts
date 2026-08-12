import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { getUserEpsPermissions, canManageEquipment } from "@/lib/auth/eps-rbac";
import { logEvent } from "@/lib/telemetry/logger";
import { ShellEventBus } from "@/lib/shell/event-bus";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
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

/**
 * GET /api/modules/eps/equipment/[id]
 *
 * Получить детальную информацию об оборудовании по ID или коду.
 *
 * @requires Permission: eps.equipment.read
 * @returns {Promise<{ item: Equipment }>}
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const { id } = await params;

  try {
    const item = await prisma.equipment.findFirst({
      where: {
        OR: [{ id: id }, { equipmentCode: id }],
      },
    });

    if (item) {
      return createSuccessResponse({ item }, request);
    }

    return createErrorResponse(
      "NOT_FOUND",
      "Оборудование не найдено",
      undefined,
      404,
      request
    );
  } catch (err) {
    console.error("EPS Equipment GET failed:", err);
    logEvent({
      level: "error",
      module: "EPS",
      action: "EQUIPMENT_GET_FAILED",
      userId: session.id,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка базы данных при получении оборудования",
      undefined,
      500,
      request
    );
  }
}

/**
 * PUT /api/modules/eps/equipment/[id]
 *
 * Обновить паспорт оборудования с созданием новой версии.
 *
 * @requires Permission: eps.equipment.update
 * @returns {Promise<{ success: true, item: Equipment }>}
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
        action: "EQUIPMENT_UPDATE_DENIED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Редактирование паспорта оборудования доступно только редакторам и администраторам.",
        undefined,
        403,
        request
      );
    }

    const { id } = await params;

    // 1. Поиск существующего оборудования
    const existing = await prisma.equipment.findFirst({
      where: {
        OR: [{ id: id }, { equipmentCode: id }],
      },
    });

    if (!existing) {
      return createErrorResponse(
        "NOT_FOUND",
        "Оборудование не найдено",
        undefined,
        404,
        request
      );
    }

    // SEC-01: Proactive RBAC check for equipment responsibility
    const canManage = await canManageEquipment(existing.id);
    if (!canManage) {
      logEvent({
        level: "warn",
        module: "EPS",
        action: "EQUIPMENT_UPDATE_DENIED_RESPONSIBILITY",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { equipmentId: existing.id },
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Вы не являетесь ответственным лицом или назначенным администратором для данного оборудования.",
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
        "Неверный формат JSON тела запроса",
        undefined,
        400,
        request
      );
    }

    // SEC-02: Zod validation
    const validation = equipmentUpdateSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные данные запроса",
        validation.error.format(),
        400,
        request
      );
    }

    const data = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Создаем историческую версию оборудования со снапшотом текущего состояния
      await tx.equipmentVersion.create({
        data: {
          equipmentId: existing.id,
          versionNumber: existing.currentVersion,
          changeSummary: data.changeSummary || `Обновление паспорта оборудования (v${existing.currentVersion + 1})`,
          snapshot: JSON.parse(JSON.stringify(existing)),
          createdById: session.id,
        },
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
        } as unknown as Prisma.EquipmentUpdateInput,
      });

      return updated;
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "EQUIPMENT_UPDATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { equipmentId: existing.id, newVersion: result.currentVersion },
    });

    await ShellEventBus.publish(
      "eps.equipment.updated",
      "EPS",
      {
        equipmentId: existing.id,
        equipmentCode: existing.equipmentCode,
        newVersion: result.currentVersion,
        performedBy: session.id,
        performedByEmail: session.email,
      },
      correlationId
    );

    return createSuccessResponse({ success: true, item: result }, request);
  } catch (err) {
    console.error("EPS Equipment update failed:", err);
    logEvent({
      level: "error",
      module: "EPS",
      action: "EQUIPMENT_UPDATE_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка базы данных при обновлении паспорта",
      undefined,
      500,
      request
    );
  }
}

/**
 * DELETE /api/modules/eps/equipment/[id]
 *
 * LOG-04: Soft Delete / Safe Decommissioning — переводит оборудование в DECOMMISSIONED.
 *
 * @requires Permission: eps.equipment.delete (только ADMIN)
 * @returns {Promise<{ success: true, message: string, item: Equipment }>}
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    const permissions = await getUserEpsPermissions();
    if (!permissions.isUnrestricted) {
      logEvent({
        level: "warn",
        module: "EPS",
        action: "EQUIPMENT_DECOMMISSION_DENIED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Вывод оборудования из эксплуатации доступен только администраторам.",
        undefined,
        403,
        request
      );
    }

    const { id } = await params;

    const existing = await prisma.equipment.findFirst({
      where: { OR: [{ id }, { equipmentCode: id }] },
    });

    if (!existing) {
      return createErrorResponse(
        "NOT_FOUND",
        "Оборудование не найдено",
        undefined,
        404,
        request
      );
    }

    const decommissioned = await prisma.$transaction(async (tx) => {
      // 1. Создаем архивную версию перед выводом из эксплуатации
      await tx.equipmentVersion.create({
        data: {
          equipmentId: existing.id,
          versionNumber: existing.currentVersion,
          changeSummary: "Архивация паспорта оборудования перед выводом из эксплуатации",
          snapshot: JSON.parse(JSON.stringify(existing)),
          createdById: session.id,
        },
      });

      // 2. Переводим статус оборудования в DECOMMISSIONED и lifecycleStage в RETIRED
      const updated = await tx.equipment.update({
        where: { id: existing.id },
        data: {
          status: "DECOMMISSIONED",
          lifecycleStage: "RETIRED",
          currentVersion: existing.currentVersion + 1,
        },
      });

      return updated;
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "EQUIPMENT_DECOMMISSIONED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { equipmentId: existing.id, code: existing.equipmentCode },
    });

    await ShellEventBus.publish(
      "eps.equipment.status_changed",
      "EPS",
      {
        equipmentId: existing.id,
        equipmentCode: existing.equipmentCode,
        newStatus: "DECOMMISSIONED",
        performedBy: session.id,
        performedByEmail: session.email,
      },
      correlationId
    );

    return createSuccessResponse(
      {
        success: true,
        message: "Оборудование успешно выведено из эксплуатации и переведено в архив",
        item: decommissioned,
      },
      request
    );
  } catch (err) {
    console.error("EPS Equipment DELETE error:", err);
    logEvent({
      level: "error",
      module: "EPS",
      action: "EQUIPMENT_DECOMMISSION_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка базы данных при списании оборудования",
      undefined,
      500,
      request
    );
  }
}
