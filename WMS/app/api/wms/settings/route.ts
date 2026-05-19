import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { resolveWmsScope } from "@/lib/wms/access-scope";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { writeAudit } from "@/lib/audit/log";

type WmsSettings = {
  general: {
    companyName: string;
    systemName: string;
    timezone: string;
    locale: string;
  };
  workflow: {
    autoReserveOnRequest: boolean;
    enforceAuditTrail: boolean;
    allowNegativeAdjustments: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    digestHour: number;
  };
  integrations: {
    mmsApiBaseUrl: string;
    epsApiBaseUrl: string;
  };
  security: {
    sessionTimeoutMinutes: number;
    ipWhitelist: string[];
  };
};

const SETTINGS_ID = "default";

function defaultSettings(): WmsSettings {
  return {
    general: {
      companyName: "EMS",
      systemName: "WMS",
      timezone: "Asia/Novosibirsk",
      locale: "ru-RU"
    },
    workflow: {
      autoReserveOnRequest: false,
      enforceAuditTrail: true,
      allowNegativeAdjustments: false
    },
    notifications: {
      emailEnabled: false,
      digestHour: 9
    },
    integrations: {
      mmsApiBaseUrl: process.env.MMS_API_BASE_URL || "http://mms-service/api",
      epsApiBaseUrl: process.env.EPS_API_BASE_URL || "http://eps-service/api"
    },
    security: {
      sessionTimeoutMinutes: 480,
      ipWhitelist: []
    }
  };
}

function coerceSettings(payload: unknown): WmsSettings {
  const defaults = defaultSettings();
  const p = (payload || {}) as Partial<WmsSettings>;
  const digestHour = Number(p.notifications?.digestHour ?? defaults.notifications.digestHour);
  const timeout = Number(p.security?.sessionTimeoutMinutes ?? defaults.security.sessionTimeoutMinutes);
  return {
    general: {
      companyName: String(p.general?.companyName ?? defaults.general.companyName).slice(0, 120),
      systemName: String(p.general?.systemName ?? defaults.general.systemName).slice(0, 120),
      timezone: String(p.general?.timezone ?? defaults.general.timezone).slice(0, 120),
      locale: String(p.general?.locale ?? defaults.general.locale).slice(0, 30)
    },
    workflow: {
      autoReserveOnRequest: Boolean(p.workflow?.autoReserveOnRequest ?? defaults.workflow.autoReserveOnRequest),
      enforceAuditTrail: Boolean(p.workflow?.enforceAuditTrail ?? defaults.workflow.enforceAuditTrail),
      allowNegativeAdjustments: Boolean(p.workflow?.allowNegativeAdjustments ?? defaults.workflow.allowNegativeAdjustments)
    },
    notifications: {
      emailEnabled: Boolean(p.notifications?.emailEnabled ?? defaults.notifications.emailEnabled),
      digestHour: Number.isFinite(digestHour) ? Math.min(23, Math.max(0, Math.floor(digestHour))) : defaults.notifications.digestHour
    },
    integrations: {
      mmsApiBaseUrl: String(p.integrations?.mmsApiBaseUrl ?? defaults.integrations.mmsApiBaseUrl).slice(0, 500),
      epsApiBaseUrl: String(p.integrations?.epsApiBaseUrl ?? defaults.integrations.epsApiBaseUrl).slice(0, 500)
    },
    security: {
      sessionTimeoutMinutes: Number.isFinite(timeout) ? Math.min(1440, Math.max(5, Math.floor(timeout))) : defaults.security.sessionTimeoutMinutes,
      ipWhitelist: Array.isArray(p.security?.ipWhitelist)
        ? p.security!.ipWhitelist.map((x) => String(x).trim()).filter(Boolean).slice(0, 100)
        : defaults.security.ipWhitelist
    }
  };
}

export async function GET() {
  const user = await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const scope = await resolveWmsScope(prisma, { email: user.email, roles: user.roles });
  if (!(scope.access === "ADMIN" || scope.access === "CENTRAL")) {
    return NextResponse.json({ error: "Настройки доступны только центральному складу или администратору." }, { status: 403 });
  }

  const row = await prisma.wmsProjectSettings.findUnique({ where: { id: SETTINGS_ID } });
  const settings = row ? coerceSettings(row.payload) : defaultSettings();
  return NextResponse.json({
    settings,
    system: {
      updatedAt: row?.updatedAt || null,
      updatedBy: row?.updatedBy || null
    }
  });
}

export async function PUT(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "wms:settings:update" });
  if (rateLimited) return rateLimited;

  const user = await requireAnyRole(["ADMIN"]);
  const payload = coerceSettings(await req.json());
  const updated = await prisma.wmsProjectSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { payload, updatedBy: user.email },
    create: { id: SETTINGS_ID, payload, updatedBy: user.email }
  });
  await writeAudit(prisma, {
    actorEmail: user.email,
    action: "UPDATE",
    entityType: "WMS_SETTINGS",
    entityId: SETTINGS_ID,
    afterState: payload
  });
  return NextResponse.json({ ok: true, settings: payload, updatedAt: updated.updatedAt, updatedBy: updated.updatedBy });
}
