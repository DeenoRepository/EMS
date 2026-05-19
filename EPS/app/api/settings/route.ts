import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { checkAuthProviderHealth, getAuthProviderName } from "@/lib/auth/provider";
import { readProjectSettings, writeProjectSettings } from "@/lib/settings/store";
import { writeAuditLog } from "@/lib/audit";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";

const settingsPatchSchema = z.object({
  general: z.object({
    companyName: z.string().min(1).max(120).optional(),
    siteName: z.string().min(1).max(120).optional(),
    timezone: z.string().min(1).max(120).optional(),
    locale: z.string().min(2).max(20).optional()
  }).optional(),
  workflow: z.object({
    equipmentChangesRequireApproval: z.boolean().optional(),
    documentChangesRequireApproval: z.boolean().optional(),
    rollbackEnabledForApprover: z.boolean().optional(),
    enforceAuditTrail: z.boolean().optional()
  }).optional(),
  documents: z.object({
    requiredByEquipmentType: z.record(z.string(), z.array(z.string())).optional()
  }).optional(),
  ui: z.object({
    defaultPageSize: z.number().int().min(5).max(200).optional(),
    dateFormat: z.string().min(2).max(30).optional(),
    desktopFirst: z.boolean().optional()
  }).optional(),
  storage: z.object({
    localMode: z.enum(["UPLOADS", "NETWORK_DRIVE"]).optional(),
    networkDiskPath: z.string().min(1).max(1024).optional()
  }).optional(),
  integrations: z.object({
    ldapEnabled: z.boolean().optional(),
    ldapUrl: z.string().min(5).max(255).optional(),
    ldapBaseDn: z.string().min(3).max(255).optional(),
    ldapUserBaseDn: z.string().min(3).max(255).optional(),
    ldapGroupBaseDn: z.string().min(3).max(255).optional()
  }).optional()
});

export async function GET() {
  await requireAnyRole(["ADMIN"]);

  const [settings, ldapHealth, equipmentTotal, documentsTotal, approvalsPending, usersActive] = await Promise.all([
    readProjectSettings(),
    checkAuthProviderHealth(),
    prisma.equipment.count(),
    prisma.document.count(),
    prisma.approvalRequest.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { isActive: true } })
  ]);

  let dbHealthy = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbHealthy = false;
  }

  return NextResponse.json({
    settings,
    system: {
      appVersion: process.env.npm_package_version || "0.1.0",
      nodeVersion: process.version,
      provider: getAuthProviderName(),
      database: dbHealthy ? "доступна" : "недоступна",
      ldapHealth,
      counts: {
        equipmentTotal,
        documentsTotal,
        approvalsPending,
        usersActive
      }
    }
  });
}

export async function PATCH(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "settings:update", limit: 40, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  const user = await requireAnyRole(["ADMIN"]);
  const payload = settingsPatchSchema.parse(await req.json());

  const before = await readProjectSettings();
  const next = await writeProjectSettings(payload);

  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "Settings",
    entityId: "project",
    beforeState: before,
    afterState: next,
    metadata: { scope: Object.keys(payload) }
  });

  return NextResponse.json({ ok: true, settings: next });
}

