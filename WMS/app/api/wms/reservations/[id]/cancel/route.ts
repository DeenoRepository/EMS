import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { cancelReservationSchema } from "@/lib/validators/schemas";
import { prisma } from "@/lib/db/prisma";
import { stockService } from "@/lib/wms/stock-service";
import { resolveWmsScope } from "@/lib/wms/access-scope";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:reservations:cancel" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
    return NextResponse.json({ error: "Отмена резерва доступна только центральному складу или администратору." }, { status: 403 });
  }
  const { id } = await params;
  const payload = cancelReservationSchema.parse(await req.json().catch(() => ({})));

  try {
    const updated = await stockService.cancelReservation(
      { prisma, actor: user.email },
      id,
      { comment: payload.comment, createdBy: payload.createdBy }
    );
    return NextResponse.json({ ...updated, quantity: Number(updated.quantity.toString()) });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message === "RESERVATION_NOT_FOUND") {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (error.message === "RESERVATION_NOT_ACTIVE") {
      return NextResponse.json({ error: "Reservation is not active" }, { status: 400 });
    }
    return NextResponse.json({ error: "Reservation cancel failed" }, { status: 400 });
  }
}
