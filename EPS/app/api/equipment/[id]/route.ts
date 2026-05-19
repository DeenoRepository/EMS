import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { equipmentUpdateSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { isEquipmentApprovalRequired } from "@/lib/settings/runtime";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { Prisma } from "@prisma/client";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const item = await prisma.equipment.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
    }

    return NextResponse.json({
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
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "equipment:update" });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;
  const payloadParsed = equipmentUpdateSchema.safeParse(await req.json().catch(() => ({})));
  if (!payloadParsed.success) {
    return NextResponse.json({ error: "Некорректные данные формы оборудования" }, { status: 400 });
  }
  const payload = payloadParsed.data;
  const approvalRequired = await isEquipmentApprovalRequired();
  const toDate = (value?: string) => (value ? new Date(value) : undefined);

  const before = await prisma.equipment.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const effectiveType = payload.type ?? before.type ?? "";
  const customAttributes = ((payload.customAttributes as Record<string, unknown> | undefined) ??
    ((before.customAttributes as Record<string, unknown> | null) || {})) as Record<string, unknown>;

  if (effectiveType) {
    const requiredAttributes = await prisma.equipmentTypeAttribute.findMany({
      where: { typeValue: effectiveType, isActive: true, required: true },
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

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.equipment.update({
        where: { id },
        data: {
          equipmentCode: payload.equipmentCode,
          name: payload.name,
          type: payload.type,
          category: payload.category,
          model: payload.model,
          serialNumber: payload.serialNumber,
          inventoryNumber: payload.inventoryNumber?.trim() || payload.inventoryNumber || undefined,
          department: payload.department,
          responsibleUserId: payload.responsibleUserId,
          manufacturer: payload.manufacturer,
          supplier: payload.supplier,
          productionDate: toDate(payload.productionDate),
          deliveryDate: toDate(payload.deliveryDate),
          commissioningDate: toDate(payload.commissioningDate),
          location: payload.location,
          status: payload.status,
          lifecycleStage: payload.lifecycleStage,
          warrantyExpiration: toDate(payload.warrantyExpiration),
          serviceDueDate: toDate(payload.serviceDueDate),
          notes: payload.notes,
          customAttributes: customAttributes as Prisma.InputJsonValue,
          currentVersion: { increment: 1 }
        }
      });

      const createdVersion = await tx.equipmentVersion.create({
        data: {
          equipmentId: id,
          versionNumber: next.currentVersion,
          changeSummary: payload.changeSummary || "Оборудование обновлено",
          snapshot: next,
          createdById: user.id
        }
      });

      await tx.equipmentEvent.create({
        data: {
          equipmentId: id,
          eventType: payload.status ? "STATUS_CHANGED" : "UPDATED",
          title: payload.status ? `Статус изменен: ${payload.status}` : "Оборудование обновлено",
          description: payload.changeSummary,
          actorId: user.id
        }
      });

      if (payload.submitForApproval && approvalRequired) {
        await tx.approvalRequest.create({
          data: {
            targetType: "EQUIPMENT_VERSION",
            targetId: createdVersion.id,
            requestedById: user.id,
            status: "PENDING",
            comments: payload.changeSummary || "Изменение оборудования отправлено на согласование"
          }
        });

        await tx.equipmentEvent.create({
          data: {
            equipmentId: id,
            eventType: "APPROVAL_SUBMITTED",
            title: "Изменение отправлено на согласование",
            description: payload.changeSummary || undefined,
            actorId: user.id
          }
        });
      } else if (!approvalRequired) {
        await tx.equipmentEvent.create({
          data: {
            equipmentId: id,
            eventType: "UPDATED",
            title: "Согласование отключено настройками",
            description: "Требование согласования оборудования отключено в настройках проекта",
            actorId: user.id
          }
        });
      }

      return next;
    });

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "UPDATE",
      entityType: "Equipment",
      entityId: updated.id,
      beforeState: before,
      afterState: updated
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Нарушение уникальности: проверьте код или инвентарный номер оборудования" }, { status: 409 });
      }
      if (error.code === "P2003") {
        return NextResponse.json({ error: "Некорректная ссылка: проверьте выбранного ответственного пользователя" }, { status: 400 });
      }
    }
    return NextResponse.json({ error: "Не удалось сохранить оборудование" }, { status: 500 });
  }
}
