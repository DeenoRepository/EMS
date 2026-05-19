import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parsePagination, parseSort } from "@/lib/pagination";
import { requireAnyRole } from "@/lib/auth/rbac";
import { createReservationSchema } from "@/lib/validators/schemas";
import { stockService } from "@/lib/wms/stock-service";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { resolveWmsScope } from "@/lib/wms/access-scope";
import { z } from "zod";
import { mmsApiClient } from "@/lib/integrations/mms-api-client";
import { isIntegrationAuthorized } from "@/lib/security/integration-auth";

export async function GET(req: NextRequest) {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
    return NextResponse.json({ error: "Доступ к резервам только у ответственного центрального склада или администратора." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const mmsWorkOrderId = searchParams.get("mmsWorkOrderId") || "";
    const rawStatus = searchParams.get("status") || "all";
    const status = rawStatus.toUpperCase();
    const pagination = parsePagination(searchParams, { pageSize: 20, maxPageSize: 200 });
    const sort = parseSort(searchParams, ["createdAt", "updatedAt"], "updatedAt");

    const where = {
      ...(mmsWorkOrderId ? { mmsWorkOrderId } : {}),
      ...(status !== "ALL" ? { status: status as any } : {})
    };

    const [items, total] = await Promise.all([
      prisma.stockReservation.findMany({
        where,
        include: {
          item: true,
          warehouse: true
        },
        orderBy: { [sort.sortBy]: sort.order },
        skip: pagination.skip,
        take: pagination.pageSize
      }),
      prisma.stockReservation.count({ where })
    ]);

    return NextResponse.json({
      items: items.map((row) => ({ ...row, quantity: Number(row.quantity.toString()) })),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить резервы." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const serviceTokenOk = isIntegrationAuthorized(req);
  if (!serviceTokenOk) {
    enforceSameOrigin(req);
  }
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:reservations:create" });
  if (rateLimited) return rateLimited;

  let user;
  if (!serviceTokenOk) {
    try {
      user = await requireAnyRole(["EDITOR", "ADMIN"]);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    user = { email: "mms-integration@system.local", roles: ["ADMIN"] as const };
  }
  if (!serviceTokenOk) {
    const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
    if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
      return NextResponse.json({ error: "Создание резервов доступно только центральному складу или администратору." }, { status: 403 });
    }
  }
  const body = await req.json().catch(() => ({}));
  const payload = createReservationSchema.safeParse(body);

  const mmsReservationSchema = z.object({
    equipmentId: z.string().min(1),
    taskId: z.string().nullable().optional(),
    workOrderId: z.string().nullable().optional(),
    items: z
      .array(
        z.object({
          sku: z.string().min(1),
          quantity: z.number().positive(),
          note: z.string().nullable().optional()
        })
      )
      .min(1)
  });

  const mmsPayload = mmsReservationSchema.safeParse(body);
  if (!payload.success && !mmsPayload.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    if (payload.success) {
      const created = await stockService.reserve(
        { prisma, actor: user.email },
        {
          itemId: payload.data.itemId,
          warehouseId: payload.data.warehouseId,
          mmsWorkOrderId: payload.data.mmsWorkOrderId,
          mmsRequiredPartId: payload.data.mmsRequiredPartId,
          quantity: payload.data.quantity
        }
      );

      return NextResponse.json(
        {
          reservation_id: created.reservationId,
          status: "active",
          item_id: created.itemId,
          quantity: created.quantity,
          warehouse_id: created.warehouseId
        },
        { status: 201 }
      );
    }

    const data = mmsPayload.data;
    const workOrderRef = (data.workOrderId || data.taskId || data.equipmentId).trim();
    const reservationGroupId = `WMS-RES-${Date.now()}`;
    const skuList = Array.from(new Set(data.items.map((item) => item.sku.trim())));
    const stockItems = await prisma.stockItem.findMany({
      where: { sku: { in: skuList } }
    });
    const itemBySku = new Map(stockItems.map((item) => [item.sku, item]));
    const missing = skuList.filter((sku) => !itemBySku.has(sku));
    if (missing.length > 0) {
      return NextResponse.json({ error: `Reservation conflict: unknown sku ${missing[0]}` }, { status: 409 });
    }

    const createdItems: Array<{ sku: string; reservationId: string; quantity: number; status: string }> = [];
    for (let idx = 0; idx < data.items.length; idx += 1) {
      const item = data.items[idx];
      const mapped = itemBySku.get(item.sku.trim());
      if (!mapped) continue;
      const created = await stockService.reserve(
        { prisma, actor: user.email },
        {
          itemId: mapped.id,
          mmsWorkOrderId: workOrderRef,
          mmsRequiredPartId: `${reservationGroupId}:${idx + 1}:${item.sku}`,
          quantity: item.quantity
        }
      );
      createdItems.push({
        sku: item.sku,
        reservationId: created.reservationId,
        quantity: created.quantity,
        status: "RESERVED"
      });
    }

    await mmsApiClient.trySendWmsWebhook({
      reservationId: reservationGroupId,
      status: "RESERVED",
      source: "wms"
    });

    return NextResponse.json(
      {
        ok: true,
        reservationId: reservationGroupId,
        status: "RESERVED",
        payload: {
          equipmentId: data.equipmentId,
          workOrderId: data.workOrderId ?? null,
          taskId: data.taskId ?? null,
          items: createdItems
        }
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "Reservation conflict" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
