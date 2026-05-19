import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { resolveDownloadUrl } from "@/lib/storage/provider";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { documentUpdateSchema } from "@/lib/validators/schemas";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      equipment: { select: { id: true, equipmentCode: true, name: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { createdBy: { select: { displayName: true, email: true } } }
      }
    }
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...document,
    versions: document.versions.map((version) => ({
      ...version,
      downloadUrl: resolveDownloadUrl(version.storagePath)
    }))
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "documents:delete" });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;

  const before = await prisma.document.findUnique({
    where: { id },
    include: { versions: { select: { id: true } } }
  });

  if (!before) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (before.status !== "DRAFT") {
    return NextResponse.json({ error: "Only draft documents can be deleted" }, { status: 409 });
  }

  const versionIds = before.versions.map((version) => version.id);

  await prisma.$transaction(async (tx) => {
    if (versionIds.length > 0) {
      await tx.approvalRequest.deleteMany({
        where: {
          targetType: "DOCUMENT_VERSION",
          targetId: { in: versionIds },
          status: { in: ["DRAFT", "PENDING"] }
        }
      });
    }

    await tx.document.delete({ where: { id } });

    await tx.equipmentEvent.create({
      data: {
        equipmentId: before.equipmentId,
        eventType: "UPDATED",
        title: "Черновик документа удален",
        description: before.title,
        actorId: user.id
      }
    });
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "DELETE",
    entityType: "Document",
    entityId: before.id,
    beforeState: before
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "documents:update" });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;
  const payload = documentUpdateSchema.parse(await req.json());

  const before = await prisma.document.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (!["DRAFT", "REJECTED"].includes(before.status)) {
    return NextResponse.json({ error: "Only draft or rejected documents can be edited" }, { status: 409 });
  }

  const hasFileUpdate = Boolean(payload.fileName || payload.storagePath || payload.checksum);
  if (hasFileUpdate && (!payload.fileName || !payload.storagePath || !payload.checksum)) {
    return NextResponse.json({ error: "fileName, storagePath and checksum are required for file update" }, { status: 400 });
  }
  const latestVersion =
    hasFileUpdate
      ? await prisma.documentVersion.findFirst({
          where: { documentId: id },
          orderBy: { versionNumber: "desc" }
        })
      : null;
  if (hasFileUpdate && !latestVersion) {
    return NextResponse.json({ error: "Document has no versions" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.document.update({
      where: { id },
      data: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.docType !== undefined ? { docType: payload.docType } : {})
      }
    });

    if (hasFileUpdate) {
      await tx.documentVersion.update({
        where: { id: latestVersion!.id },
        data: {
          fileName: payload.fileName!,
          storagePath: payload.storagePath!,
          checksum: payload.checksum!,
          ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
          metadata: { source: "document_edit_replace" }
        }
      });
    }

    return next;
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
