import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { documentCreateSchema } from "@/lib/validators/schemas";
import { writeAuditLog } from "@/lib/audit";
import { parsePagination, parseSort } from "@/lib/pagination";
import { DocumentType } from "@prisma/client";
import { getDefaultPageSize, isDocumentApprovalRequired } from "@/lib/settings/runtime";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { resolveDownloadUrl } from "@/lib/storage/provider";

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const defaultPageSize = await getDefaultPageSize();
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status");
  const equipmentId = searchParams.get("equipmentId");
  const docType = searchParams.get("docType");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const normalizedDocType = q.toUpperCase().replace(/\s+/g, "_");
  const qAsDocType = Object.values(DocumentType).includes(normalizedDocType as DocumentType)
    ? (normalizedDocType as DocumentType)
    : null;
  const pagination = parsePagination(searchParams, { pageSize: defaultPageSize, maxPageSize: 100 });
  const sort = parseSort(searchParams, ["title", "docType", "status", "updatedAt", "createdAt"] as const, "updatedAt");

  const where = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            ...(qAsDocType ? [{ docType: qAsDocType }] : []),
            { equipment: { name: { contains: q, mode: "insensitive" as const } } },
            { equipment: { equipmentCode: { contains: q, mode: "insensitive" as const } } }
          ]
        }
      : {}),
    ...(status && status !== "all" ? { status: status as any } : {}),
    ...(equipmentId ? { equipmentId } : {}),
    ...(docType && docType !== "all" ? { docType: docType as DocumentType } : {}),
    ...(dateFrom || dateTo
      ? {
          updatedAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {})
          }
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        equipment: { select: { id: true, equipmentCode: true, name: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: { createdBy: { select: { displayName: true, email: true } } },
          take: 10
        }
      },
      orderBy: { [sort.sortBy]: sort.order },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.document.count({ where })
  ]);

  const mapped = items.map((document) => ({
    ...document,
    versions: document.versions.map((version) => ({
      ...version,
      downloadUrl: resolveDownloadUrl(version.storagePath)
    }))
  }));

  return NextResponse.json({
    items: mapped,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize
  });
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "documents:create" });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const payload = documentCreateSchema.parse(await req.json());
  const approvalRequired = await isDocumentApprovalRequired();

  const created = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        equipmentId: payload.equipmentId,
        title: payload.title,
        docType: payload.docType,
        status: approvalRequired ? "DRAFT" : "APPROVED"
      }
    });

    await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        fileName: payload.fileName,
        storagePath: payload.storagePath,
        checksum: payload.checksum,
        notes: payload.notes,
        metadata: {},
        createdById: user.id
      }
    });

    await tx.equipmentEvent.create({
      data: {
        equipmentId: payload.equipmentId,
        eventType: "DOCUMENT_ATTACHED",
        title: `Документ ${payload.title} добавлен`,
        description: approvalRequired ? "Документ создан в черновике и требует согласования" : "Документ согласован автоматически настройками",
        actorId: user.id
      }
    });

    return doc;
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "Document",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json(created, { status: 201 });
}
