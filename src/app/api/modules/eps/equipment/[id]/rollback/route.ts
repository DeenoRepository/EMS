import { prisma } from "@/lib/db/prisma";
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

const rollbackSchema = z.object({
  targetVersion: z.number().int().positive("targetVersion обязателен"),
});

/**
 * POST /api/modules/eps/equipment/[id]/rollback
 *
 * Откатить паспорт оборудования к указанной версии.
 *
 * @requires Permission: eps.equipment.update
 * @returns {Promise<{ success: true, message: string, item: Equipment }>}
 */
export async function POST(
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
        action: "EQUIPMENT_ROLLBACK_DENIED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Откат версий доступен только редакторам и администраторам.",
        undefined,
        403,
        request
      );
    }

    const { id } = await params;

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

    const validation = rollbackSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Необходимо указать целевой номер версии в поле targetVersion",
        validation.error.flatten(),
        400,
        request
      );
    }

    const { targetVersion: targetVersionNumber } = validation.data;

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

    // SEC-01: Proactive RBAC check
    const canManage = await canManageEquipment(existing.id);
    if (!canManage) {
      logEvent({
        level: "warn",
        module: "EPS",
        action: "EQUIPMENT_ROLLBACK_DENIED_RESPONSIBILITY",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
        details: { equipmentId: existing.id },
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Отказано в доступе. Вы не являетесь ответственным лицом для данного оборудования.",
        undefined,
        403,
        request
      );
    }

    const targetVersionRecord = await prisma.equipmentVersion.findFirst({
      where: {
        equipmentId: existing.id,
        versionNumber: targetVersionNumber,
      },
    });

    if (!targetVersionRecord) {
      return createErrorResponse(
        "NOT_FOUND",
        `Версия v${targetVersionNumber} не найдена в истории данного оборудования`,
        undefined,
        404,
        request
      );
    }

    const snapshot = targetVersionRecord.snapshot as Record<string, unknown>;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Сохраняем перед откатом текущее состояние как отдельную историческую версию
      await tx.equipmentVersion.create({
        data: {
          equipmentId: existing.id,
          versionNumber: existing.currentVersion,
          changeSummary: `Автоматическое сохранение перед откатом к версии v${targetVersionNumber}`,
          snapshot: JSON.parse(JSON.stringify(existing)),
          createdById: session.id,
        },
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
          criticality: snapshot.criticality ?? (existing as Record<string, unknown>).criticality,
          manufacturer: snapshot.manufacturer ?? existing.manufacturer,
          supplier: snapshot.supplier ?? existing.supplier,
          countryOfOrigin: snapshot.countryOfOrigin ?? (existing as Record<string, unknown>).countryOfOrigin,
          isImported: snapshot.isImported ?? (existing as Record<string, unknown>).isImported,
          isUnique: snapshot.isUnique ?? (existing as Record<string, unknown>).isUnique,
          productionDate: snapshot.productionDate ?? existing.productionDate,
          deliveryDate: snapshot.deliveryDate ?? existing.deliveryDate,
          commissioningDate: snapshot.commissioningDate ?? existing.commissioningDate,
          warrantyExpiration: snapshot.warrantyExpiration ?? existing.warrantyExpiration,
          serviceDueDate: snapshot.serviceDueDate ?? existing.serviceDueDate,
          notes: `[Откат к v${targetVersionNumber}] ${snapshot.notes || ""}`,
          techSpecs: snapshot.techSpecs ?? (existing as Record<string, unknown>).techSpecs,
          currentVersion: existing.currentVersion + 1,
        },
      });

      return restored;
    });

    logEvent({
      level: "audit",
      module: "EPS",
      action: "EQUIPMENT_ROLLBACK",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: {
        equipmentId: existing.id,
        restoredFromVersion: targetVersionNumber,
        newVersion: updated.currentVersion,
      },
    });

    await ShellEventBus.publish(
      "eps.equipment.updated",
      "EPS",
      {
        equipmentId: existing.id,
        equipmentCode: existing.equipmentCode,
        action: "ROLLBACK",
        restoredFromVersion: targetVersionNumber,
        newVersion: updated.currentVersion,
        performedBy: session.id,
        performedByEmail: session.email,
      },
      correlationId
    );

    return createSuccessResponse(
      {
        success: true,
        message: `Паспорт успешно откачен к состоянию версии v${targetVersionNumber}`,
        item: updated,
      },
      request
    );
  } catch (err) {
    console.error("EPS Equipment Rollback failed:", err);
    logEvent({
      level: "error",
      module: "EPS",
      action: "EQUIPMENT_ROLLBACK_FAILED",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка базы данных при выполнении отката версии",
      undefined,
      500,
      request
    );
  }
}
