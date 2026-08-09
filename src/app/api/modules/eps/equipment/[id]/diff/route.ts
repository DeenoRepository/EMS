import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const v1Param = searchParams.get("v1");
  const v2Param = searchParams.get("v2");

  if (!v1Param || !v2Param) {
    return NextResponse.json(
      { error: "Необходимо указать версии v1 и v2 для сравнения (например, ?v1=1&v2=2)" },
      { status: 400 }
    );
  }

  const v1Number = parseInt(v1Param, 10);
  const v2Number = parseInt(v2Param, 10);

  if (isNaN(v1Number) || isNaN(v2Number)) {
    return NextResponse.json({ error: "Номера версий должны быть числами" }, { status: 400 });
  }

  try {
    const equipment = await prisma.equipment.findFirst({
      where: { OR: [{ id }, { equipmentCode: id }] }
    });

    if (!equipment) {
      return NextResponse.json({ error: "Оборудование не найдено" }, { status: 404 });
    }

    const versions = await prisma.equipmentVersion.findMany({
      where: {
        equipmentId: equipment.id,
        versionNumber: { in: [v1Number, v2Number] }
      }
    });

    const version1 = versions.find((v) => v.versionNumber === v1Number);
    const version2 = versions.find((v) => v.versionNumber === v2Number);

    if (!version1 || !version2) {
      return NextResponse.json(
        { error: `Одна из указанных версий (${v1Number} или ${v2Number}) не найдена в истории` },
        { status: 404 }
      );
    }

    const snap1 = (version1.snapshot as Record<string, any>) || {};
    const snap2 = (version2.snapshot as Record<string, any>) || {};

    const allKeys = Array.from(new Set([...Object.keys(snap1), ...Object.keys(snap2)]));
    const diffs: Record<string, { v1: any; v2: any; changed: boolean }> = {};

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
        changed
      };
    }

    return NextResponse.json({
      equipmentId: equipment.id,
      equipmentCode: equipment.equipmentCode,
      v1: v1Number,
      v2: v2Number,
      totalChanges,
      diffs
    });
  } catch (err) {
    console.error("EPS Equipment Diff error:", err);
    return NextResponse.json({ error: "Ошибка при формировании сравнения версий" }, { status: 500 });
  }
}
