import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { isDocumentApprovalRequired } from "@/lib/settings/runtime";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "documents:versions:create" });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const { id } = await params;
  const approvalRequired = await isDocumentApprovalRequired();

  const body = await req.json();
  const existing = await prisma.document.findUnique({ where: { id }, include: { versions: true } });
  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const version = await prisma.documentVersion.create({
    data: {
      documentId: id,
      versionNumber: existing.versions.length + 1,
      fileName: body.fileName,
      storagePath: body.storagePath,
      checksum: body.checksum,
      notes: body.notes,
      metadata: body.metadata || {},
      createdById: user.id
    }
  });

  await prisma.document.update({ where: { id }, data: { status: approvalRequired ? "DRAFT" : "APPROVED" } });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "DocumentVersion",
    entityId: version.id,
    afterState: version
  });

  return NextResponse.json(version, { status: 201 });
}
