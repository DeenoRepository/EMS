import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { parsePagination } from "@/lib/pagination";
import { approvalCreateSchema } from "@/lib/validators/schemas";
import { getDefaultPageSize } from "@/lib/settings/runtime";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { hasAnyRole } from "@/lib/rbac/permissions";

export async function GET(req: NextRequest) {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const { searchParams } = new URL(req.url);
  const defaultPageSize = await getDefaultPageSize();
  const status = searchParams.get("status");
  const requestedByEmail = searchParams.get("requestedByEmail");
  const targetType = searchParams.get("targetType");
  const action = searchParams.get("action");
  const q = searchParams.get("q") || "";
  const pagination = parsePagination(searchParams, { pageSize: defaultPageSize, maxPageSize: 100 });

  if (requestedByEmail && !hasAnyRole(user.roles, ["EDITOR", "ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: any = {
    ...(status && status !== "all" ? { status } : {}),
    ...(targetType && targetType !== "all" ? { targetType } : {}),
    ...(action ? { comments: { contains: action, mode: "insensitive" as const } } : {}),
    ...(requestedByEmail ? { requestedBy: { email: requestedByEmail } } : {}),
    ...(q
      ? {
          OR: [
            { comments: { contains: q, mode: "insensitive" as const } },
            { requestedBy: { displayName: { contains: q, mode: "insensitive" as const } } },
            { requestedBy: { email: { contains: q, mode: "insensitive" as const } } }
          ]
        }
      : {})
  };

  const [approvals, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include: {
        requestedBy: { select: { displayName: true, email: true } },
        assignedApprover: { select: { displayName: true, email: true } },
        decidedBy: { select: { displayName: true, email: true } }
      },
      orderBy: { submittedAt: "desc" },
      skip: pagination.skip,
      take: pagination.pageSize
    }),
    prisma.approvalRequest.count({ where })
  ]);

  const equipmentVersionIds = approvals.filter((a) => a.targetType === "EQUIPMENT_VERSION").map((a) => a.targetId);
  const documentVersionIds = approvals.filter((a) => a.targetType === "DOCUMENT_VERSION").map((a) => a.targetId);

  const [equipmentVersions, documentVersions] = await Promise.all([
    equipmentVersionIds.length
      ? prisma.equipmentVersion.findMany({
          where: { id: { in: equipmentVersionIds } },
          include: { equipment: { select: { id: true, equipmentCode: true, name: true } } }
        })
      : Promise.resolve([]),
    documentVersionIds.length
      ? prisma.documentVersion.findMany({
          where: { id: { in: documentVersionIds } },
          include: {
            document: {
              include: { equipment: { select: { id: true, equipmentCode: true, name: true } } }
            }
          }
        })
      : Promise.resolve([])
  ]);

  const equipmentVersionMap = new Map(equipmentVersions.map((v) => [v.id, v]));
  const documentVersionMap = new Map(documentVersions.map((v) => [v.id, v]));
  const unresolvedEquipmentIds = equipmentVersionIds.filter((targetId) => !equipmentVersionMap.has(targetId));
  const directEquipmentTargets = unresolvedEquipmentIds.length
    ? await prisma.equipment.findMany({
        where: { id: { in: unresolvedEquipmentIds } },
        select: { id: true, equipmentCode: true, name: true }
      })
    : [];
  const directEquipmentMap = new Map(directEquipmentTargets.map((item) => [item.id, item]));

  const enriched = approvals.map((approval) => {
    if (approval.targetType === "EQUIPMENT_VERSION") {
      const target = equipmentVersionMap.get(approval.targetId);
      const directEquipment = directEquipmentMap.get(approval.targetId);
      return {
        ...approval,
        target: target
          ? {
              equipmentId: target.equipment.id,
              equipmentCode: target.equipment.equipmentCode,
              equipmentName: target.equipment.name,
              label: `Оборудование v${target.versionNumber}`
            }
          : directEquipment
            ? {
                equipmentId: directEquipment.id,
                equipmentCode: directEquipment.equipmentCode,
                equipmentName: directEquipment.name,
                label: directEquipment.equipmentCode
              }
            : null
      };
    }

    const target = documentVersionMap.get(approval.targetId);
    return {
      ...approval,
      target: target
        ? {
            equipmentId: target.document.equipment.id,
            equipmentCode: target.document.equipment.equipmentCode,
            equipmentName: target.document.equipment.name,
            documentId: target.document.id,
            documentTitle: target.document.title,
            label: `${target.document.title} v${target.versionNumber}`
          }
        : null
    };
  });

  return NextResponse.json({
    items: enriched,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize
  });
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "approvals:create" });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["EDITOR", "ADMIN"]);
  const body = approvalCreateSchema.parse(await req.json());

  const created = await prisma.approvalRequest.create({
    data: {
      targetType: body.targetType,
      targetId: body.targetId,
      requestedById: user.id,
      assignedApproverId: body.assignedApproverId,
      status: body.status || "PENDING",
      comments: body.comments
    }
  });

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "CREATE",
    entityType: "ApprovalRequest",
    entityId: created.id,
    afterState: created
  });

  return NextResponse.json(created, { status: 201 });
}
