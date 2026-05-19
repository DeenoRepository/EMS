import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { parsePagination } from "@/lib/pagination";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { resolveWmsScope } from "@/lib/wms/access-scope";
import { writeAudit } from "@/lib/audit/log";

function responseFromThrown(error: unknown) {
  if (error instanceof Response) {
    return new NextResponse(error.body, { status: error.status, headers: error.headers });
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
    const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
    if (!(scope.access === "ADMIN" || scope.access === "AUXILIARY" || scope.access === "CENTRAL")) {
      return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const pagination = parsePagination(searchParams, { pageSize: 20, maxPageSize: 200 });
    const where = {
      ...(status !== "all" ? { status: status as any } : {}),
      ...(scope.access === "AUXILIARY" ? { fromWarehouseId: { in: scope.responsibleWarehouseIds } } : {}),
      ...(scope.access === "CENTRAL"
        ? {
            toWarehouseId: scope.centralWarehouseId || "__none__",
            fromWarehouse: { type: "AUXILIARY" }
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.internalRequest.findMany({
        where,
        include: { fromWarehouse: true, toWarehouse: true, lines: { include: { item: true } } },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize
      }),
      prisma.internalRequest.count({ where })
    ]);

    return NextResponse.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
  } catch (error) {
    return responseFromThrown(error) || NextResponse.json({ error: "Не удалось загрузить заявки." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    enforceSameOrigin(req);
    const rateLimited = enforceWriteRateLimit(req, { scope: "wms:internal-requests:create" });
    if (rateLimited) return rateLimited;

    const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
    const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
    if (!(scope.access === "ADMIN" || scope.access === "AUXILIARY")) {
      return NextResponse.json(
        { error: "Создание заявок доступно только ответственным вспомогательных складов и администратору." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as {
      fromWarehouseId: string;
      comment?: string;
      lines: Array<{ itemId: string; quantity: number }>;
    };

    if (!body.fromWarehouseId || !Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: "fromWarehouseId и lines обязательны." }, { status: 400 });
    }
    if (scope.access === "AUXILIARY" && !scope.responsibleWarehouseIds.includes(body.fromWarehouseId)) {
      return NextResponse.json({ error: "Можно создавать заявки только для своего склада." }, { status: 403 });
    }

    const primary = await prisma.warehouse.findFirst({ where: { status: "ACTIVE", type: "PRIMARY" } });
    if (!primary) return NextResponse.json({ error: "Центральный склад не настроен." }, { status: 400 });

    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.internalRequest.create({
        data: {
          requestNumber: `IR-${Date.now()}`,
          fromWarehouseId: body.fromWarehouseId,
          toWarehouseId: primary.id,
          status: "NEW",
          comment: body.comment,
          createdBy: user.email
        }
      });

      for (const line of body.lines) {
        await tx.internalRequestLine.create({
          data: {
            requestId: request.id,
            itemId: line.itemId,
            requestedQty: new Prisma.Decimal(line.quantity),
            status: "NEW"
          }
        });
      }
      return request;
    });

    await writeAudit(prisma, {
      actorEmail: user.email,
      action: "CREATE",
      entityType: "INTERNAL_REQUEST",
      entityId: created.id,
      afterState: created
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return responseFromThrown(error) || NextResponse.json({ error: "Не удалось создать заявку." }, { status: 500 });
  }
}
