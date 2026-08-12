import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/shell/api-response";
import { z } from "zod";

const diffQuerySchema = z.object({
  v1: z.coerce.number().int().positive("v1 обязателен"),
  v2: z.coerce.number().int().positive("v2 обязателен"),
});

/**
 * GET /api/modules/eps/equipment/[id]/diff
 *
 * Сравнить две версии паспорта оборудования.
 *
 * @requires Permission: eps.equipment.read
 * @returns {Promise<{ equipmentId, equipmentCode, v1, v2, totalChanges, diffs }>}
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
  const { searchParams } = new URL(request.url);
  const parseResult = diffQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Необходимо указать версии v1 и v2 для сравнения (например, ?v1=1&v2=2)",
      parseResult.error.flatten(),
      400,
      request
    );
  }

  const { v1: v1Number, v2: v2Number } = parseResult.data;

  try {
    const equipment = await prisma.equipment.findFirst({
      where: { OR: [{ id }, { equipmentCode: id }] },
    });

    if (!equipment) {
      return createErrorResponse(
        "NOT_FOUND",
        "Оборудование не найдено",
        undefined,
        404,
        request
      );
    }

    const versions = await prisma.equipmentVersion.findMany({
      where: {
        equipmentId: equipment.id,
        versionNumber: { in: [v1Number, v2Number] },
      },
    });

    const version1 = versions.find((v) => v.versionNumber === v1Number);
    const version2 = versions.find((v) => v.versionNumber === v2Number);

    if (!version1 || !version2) {
      return createErrorResponse(
        "NOT_FOUND",
        `Одна из указанных версий (${v1Number} или ${v2Number}) не найдена в истории`,
        undefined,
        404,
        request
      );
    }

    const snap1 = (version1.snapshot as Record<string, unknown>) || {};
    const snap2 = (version2.snapshot as Record<string, unknown>) || {};

    const allKeys = Array.from(new Set([...Object.keys(snap1), ...Object.keys(snap2)]));
    const diffs: Record<string, { v1: unknown; v2: unknown; changed: boolean }> = {};

    let totalChanges = 0;

    for (const key of allKeys) {
      // Игнорируем служебные системные метки времени
      if (key === "updatedAt" || key === "createdAt") continue;

      const val1 = JSON.stringify(snap1[key]);
      const val2 = JSON.stringify(snap2[key]);
      const changed = val1 !== val2;

      if (changed) totalChanges++;

      diffs[key] = {
        v1: snap1[key] ?? null,
        v2: snap2[key] ?? null,
        changed,
      };
    }

    return createSuccessResponse(
      {
        equipmentId: equipment.id,
        equipmentCode: equipment.equipmentCode,
        v1: v1Number,
        v2: v2Number,
        totalChanges,
        diffs,
      },
      request
    );
  } catch (err) {
    console.error("EPS Equipment Diff error:", err);
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка при формировании сравнения версий",
      undefined,
      500,
      request
    );
  }
}
