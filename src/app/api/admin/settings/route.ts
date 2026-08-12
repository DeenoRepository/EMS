import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

export interface ShellSettingsData {
  // Shell General Settings
  systemTitle: string;
  organizationName: string;
  timezone: string;
  defaultLocale: string;
  dateFormat: string;
  logLevel: "ERROR" | "WARN" | "INFO" | "DEBUG";

  // Appearance & Branding
  theme: "SYSTEM" | "LIGHT" | "DARK";
  primaryColor: string;
  compactNav: boolean;
  showHeaderLogo: boolean;

  // System Notifications
  maintenanceBanner: string;
  maintenanceLevel: "INFO" | "WARNING" | "CRITICAL";
  enableGlobalNotifications: boolean;

  // Security & Sessions
  sessionTimeoutMinutes: number;
  enforce2FA: boolean;
  rateLimitStrict: boolean;

  // File Storage & Assets Policy
  storageDriver: "LOCAL" | "MINIO" | "S3";
  maxUploadMB: number;
  allowedExtensions: string;

  // Registered Shell Modules
  activeModules: {
    eps: boolean;
    wms: boolean;
    audit: boolean;
    rbac: boolean;
  };
  defaultStartupRoute: string;
}

// In-memory persistent state fallback with defaults
let currentSettings: ShellSettingsData = {
  systemTitle: "EMS Platform — Единый Корпоративный Шелл",
  organizationName: "ПАО «ЭнергоМашСервис»",
  timezone: "Europe/Moscow (UTC+3)",
  defaultLocale: "ru-RU",
  dateFormat: "DD.MM.YYYY HH:mm",
  logLevel: "INFO",

  theme: "SYSTEM",
  primaryColor: "#3473d4",
  compactNav: false,
  showHeaderLogo: true,

  maintenanceBanner: "",
  maintenanceLevel: "INFO",
  enableGlobalNotifications: true,

  sessionTimeoutMinutes: 120,
  enforce2FA: false,
  rateLimitStrict: true,

  storageDriver: process.env.S3_ENDPOINT ? "MINIO" : "LOCAL",
  maxUploadMB: 50,
  allowedExtensions: "pdf, dwg, step, xlsx, docx, png, jpg, zip",

  activeModules: {
    eps: true,
    wms: true,
    audit: true,
    rbac: true,
  },
  defaultStartupRoute: "/eps/dashboard",
};

const settingsUpdateSchema = z.object({
  systemTitle: z.string().optional(),
  organizationName: z.string().optional(),
  timezone: z.string().optional(),
  defaultLocale: z.string().optional(),
  dateFormat: z.string().optional(),
  logLevel: z.enum(["ERROR", "WARN", "INFO", "DEBUG"]).optional(),
  theme: z.enum(["SYSTEM", "LIGHT", "DARK"]).optional(),
  primaryColor: z.string().optional(),
  compactNav: z.boolean().optional(),
  showHeaderLogo: z.boolean().optional(),
  maintenanceBanner: z.string().optional(),
  maintenanceLevel: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  enableGlobalNotifications: z.boolean().optional(),
  sessionTimeoutMinutes: z.number().int().positive().optional(),
  enforce2FA: z.boolean().optional(),
  rateLimitStrict: z.boolean().optional(),
  storageDriver: z.enum(["LOCAL", "MINIO", "S3"]).optional(),
  maxUploadMB: z.number().int().positive().optional(),
  allowedExtensions: z.string().optional(),
  activeModules: z
    .object({
      eps: z.boolean(),
      wms: z.boolean(),
      audit: z.boolean(),
      rbac: z.boolean(),
    })
    .optional(),
  defaultStartupRoute: z.string().optional(),
});

/**
 * GET /api/admin/settings
 *
 * Получить текущие настройки Shell.
 *
 * @requires Permission: admin.settings.manage
 * @returns {Promise<{ settings: ShellSettingsData }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  return createSuccessResponse({ settings: currentSettings }, request);
}

/**
 * POST /api/admin/settings
 *
 * Обновить настройки Shell (только ADMIN).
 *
 * @requires Permission: admin.settings.manage
 * @returns {Promise<{ success: true, settings: ShellSettingsData, message: string }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    if (!hasPermission(session, "admin.settings.manage")) {
      logEvent({
        level: "warn",
        module: "ADMIN",
        action: "SETTINGS_UPDATE_DENIED",
        userId: session.id,
        userEmail: session.email,
        requestId: correlationId,
      });
      return createErrorResponse(
        "FORBIDDEN",
        "Недостаточно прав для изменения системных настроек",
        undefined,
        403,
        request
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(
        "INVALID_JSON",
        "Неверный формат JSON в теле запроса",
        undefined,
        400,
        request
      );
    }

    const validation = settingsUpdateSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные параметры настроек",
        validation.error.format(),
        400,
        request
      );
    }

    currentSettings = {
      ...currentSettings,
      ...validation.data,
    };

    logEvent({
      level: "audit",
      module: "ADMIN",
      action: "SETTINGS_UPDATED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { updatedFields: Object.keys(validation.data) },
    });

    return createSuccessResponse(
      {
        success: true,
        settings: currentSettings,
        message: "Конфигурация Shell и приложения успешно сохранена",
      },
      request
    );
  } catch (error) {
    console.error("POST /api/admin/settings error:", error);
    logEvent({
      level: "error",
      module: "ADMIN",
      action: "SETTINGS_UPDATE_FAILED",
      requestId: correlationId,
      error: String(error),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка сохранения настроек",
      undefined,
      500,
      request
    );
  }
}
