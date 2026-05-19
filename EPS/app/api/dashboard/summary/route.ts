import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { readProjectSettings } from "@/lib/settings/store";

export async function GET() {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);

  const [equipment, approvals, documents, events, settings] = await Promise.all([
    prisma.equipment.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        lifecycleStage: true,
        department: true,
        status: true,
        serviceDueDate: true,
        warrantyExpiration: true,
        updatedAt: true
      }
    }),
    prisma.approvalRequest.findMany({
      select: {
        id: true,
        status: true,
        submittedAt: true,
        comments: true
      },
      orderBy: { submittedAt: "desc" },
      take: 500
    }),
    prisma.document.findMany({
      select: {
        id: true,
        equipmentId: true,
        docType: true
      }
    }),
    prisma.equipmentEvent.findMany({
      select: {
        id: true,
        title: true,
        createdAt: true,
        actor: { select: { displayName: true } },
        equipment: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    readProjectSettings()
  ]);

  return NextResponse.json({
    equipment,
    approvals,
    documents,
    events,
    requiredByEquipmentType: settings.documents.requiredByEquipmentType || { DEFAULT: ["PASSPORT", "OPERATION_MANUAL"] }
  });
}
