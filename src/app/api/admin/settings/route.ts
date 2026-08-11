import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

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

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      settings: currentSettings,
    });
  } catch (error) {
    console.error("GET /api/admin/settings error:", error);
    return NextResponse.json({ error: "Ошибка загрузки настроек" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    // RBAC check: ADMIN role or admin.settings.manage permission
    const isAdmin = session.roles.includes("ADMIN") || session.permissions?.includes("*") || session.permissions?.includes("admin.settings.manage");
    if (!isAdmin) {
      return NextResponse.json({ error: "Недостаточно прав для изменения системных настроек" }, { status: 403 });
    }

    const body = await request.json();
    currentSettings = {
      ...currentSettings,
      ...body,
    };

    return NextResponse.json({
      success: true,
      settings: currentSettings,
      message: "Конфигурация Shell и приложения успешно сохранена",
    });
  } catch (error) {
    console.error("POST /api/admin/settings error:", error);
    return NextResponse.json({ error: "Ошибка сохранения настроек" }, { status: 500 });
  }
}
