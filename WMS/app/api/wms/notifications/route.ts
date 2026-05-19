import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function GET() {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });

  const requestsPromise =
    scope.access === "AUXILIARY"
      ? prisma.internalRequest.findMany({
          where: { fromWarehouseId: { in: scope.responsibleWarehouseIds }, status: { in: ["NEW", "PARTIAL", "RESERVED", "TO_PROCUREMENT"] } },
          orderBy: { createdAt: "desc" },
          take: 5
        })
      : prisma.internalRequest.findMany({
          where: { status: { in: ["NEW", "PARTIAL", "RESERVED", "TO_PROCUREMENT"] } },
          orderBy: { createdAt: "desc" },
          take: 5
        });

  const reservationsPromise =
    scope.access === "CENTRAL" || scope.access === "ADMIN"
      ? prisma.stockReservation.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 5 })
      : Promise.resolve([]);

  const [requests, reservations] = await Promise.all([requestsPromise, reservationsPromise]);
  return NextResponse.json({
    internal_requests: requests.map((r) => ({ id: r.id, number: r.requestNumber, status: r.status })),
    active_reservations: reservations.map((r) => ({ id: r.id, quantity: Number(r.quantity.toString()), mms_work_order_id: r.mmsWorkOrderId }))
  });
}
