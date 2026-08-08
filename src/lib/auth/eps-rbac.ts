import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export interface EpsUserPermissions {
  isUnrestricted: boolean; // ADMIN
  canApprove: boolean;     // APPROVER or ADMIN
  canEdit: boolean;        // EDITOR, APPROVER, or ADMIN
  roles: string[];
}

export async function getUserEpsPermissions(): Promise<EpsUserPermissions> {
  try {
    const session = await getSession();
    if (!session) {
      return { isUnrestricted: false, canApprove: false, canEdit: false, roles: [] };
    }

    const isAdmin = session.roles.includes("ADMIN");
    const isApprover = isAdmin || session.roles.includes("APPROVER");
    const isEditor = isApprover || session.roles.includes("EDITOR");

    return {
      isUnrestricted: isAdmin,
      canApprove: isApprover,
      canEdit: isEditor,
      roles: session.roles
    };
  } catch (err) {
    console.error("getUserEpsPermissions failed:", err);
    return { isUnrestricted: false, canApprove: false, canEdit: false, roles: [] };
  }
}

export async function canManageEquipment(equipmentId: string): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session) return false;

    if (session.roles.includes("ADMIN")) return true;

    const permissions = await getUserEpsPermissions();
    if (!permissions.canEdit) return false;

    // Check if user is responsible for this equipment
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { responsibleUserId: true, department: true }
    });

    if (!equipment) return false;

    // If equipment has a responsible user set, check match with session.id
    if (equipment.responsibleUserId) {
      return equipment.responsibleUserId === session.id;
    }

    return true;
  } catch (err) {
    console.error("canManageEquipment check failed:", err);
    return false;
  }
}
