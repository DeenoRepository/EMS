import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { isDocumentApprovalRequired } from "@/lib/settings/runtime";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "documents:submit-approval" });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;
  const approvalRequired = await isDocumentApprovalRequired();

  const document = await prisma.document.findUnique({
    where: { id },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } }
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const latestVersion = document.versions[0];
  if (!latestVersion) {
    return NextResponse.json({ error: "Document has no versions" }, { status: 400 });
  }

  if (!approvalRequired) {
    await prisma.document.update({
      where: { id: document.id },
      data: { status: "APPROVED" }
    });

    await prisma.equipmentEvent.create({
      data: {
        equipmentId: document.equipmentId,
        eventType: "APPROVAL_RESOLVED",
        title: "Документ автоматически согласован",
        description: `${document.title} v${latestVersion.versionNumber}`,
        actorId: user.id
      }
    });

    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Document approval requirement is disabled in project settings"
    });
  }

  const existingPending = await prisma.approvalRequest.findFirst({
    where: {
      targetType: "DOCUMENT_VERSION",
      targetId: latestVersion.id,
      status: { in: ["DRAFT", "PENDING"] }
    }
  });

  if (existingPending) {
    return NextResponse.json(existingPending);
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: document.id },
      data: { status: "IN_REVIEW" }
    });

    const approval = await tx.approvalRequest.create({
      data: {
        targetType: "DOCUMENT_VERSION",
        targetId: latestVersion.id,
        requestedById: user.id,
        status: "PENDING",
        comments: "Документ отправлен на согласование"
      }
    });

    await tx.equipmentEvent.create({
      data: {
        equipmentId: document.equipmentId,
        eventType: "APPROVAL_SUBMITTED",
        title: "Документ отправлен на согласование",
        description: `${document.title} v${latestVersion.versionNumber}`,
        actorId: user.id
      }
    });

    return approval;
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "ApprovalRequest",
    entityId: created.id,
    metadata: { documentId: document.id, documentVersionId: latestVersion.id }
  });

  return NextResponse.json(created, { status: 201 });
}
