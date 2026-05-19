import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "documents:archive" });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;

  const before = await prisma.document.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (before.status === "ARCHIVED") {
    return NextResponse.json({ ok: true, status: "ARCHIVED", skipped: true });
  }

  if (before.status === "DRAFT") {
    return NextResponse.json({ error: "Draft document cannot be archived" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const document = await tx.document.update({
      where: { id },
      data: { status: "ARCHIVED" }
    });

    await tx.equipmentEvent.create({
      data: {
        equipmentId: document.equipmentId,
        eventType: "STATUS_CHANGED",
        title: "Документ помечен как устаревший",
        description: document.title,
        actorId: user.id
      }
    });

    return document;
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "Document",
    entityId: updated.id,
    beforeState: before,
    afterState: updated
  });

  return NextResponse.json(updated);
}
