import { prisma } from "@/lib/db/prisma";
import { AuditAction, Prisma } from "@prisma/client";

export type LogLevel = "info" | "warn" | "error" | "audit";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  action: string;
  userId?: string;
  userEmail?: string;
  requestId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  error?: string;
  stack?: string;
}

export const auditLogMemory: LogEntry[] = [];

/**
 * Отправляет ошибки в Sentry / GlitchTip если задан SENTRY_DSN
 */
function reportToSentry(entry: LogEntry) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || entry.level !== "error") return;

  try {
    // Безопасный вызов вебхука Sentry DSN без внешней тяжелой библиотеки
    const payload = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      logger: entry.module,
      platform: "node",
      level: "error",
      message: entry.action,
      exception: entry.error ? { values: [{ type: "Error", value: entry.error, stacktrace: entry.stack }] } : undefined,
      extra: entry.details,
      user: entry.userId ? { id: entry.userId, email: entry.userEmail } : undefined
    };

    fetch(dsn, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch {
    // Игнорируем сбои сети при отправке в Sentry
  }
}

/**
 * Логирует событие в формате JSON (stdout) и записывает в Prisma AuditLog
 */
export function logEvent(entry: Omit<LogEntry, "timestamp">): LogEntry {
  const requestId = entry.requestId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`);
  const fullEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    requestId,
    ...entry,
  };

  // Вывод структурированного JSON лога в stdout (для ELK / Grafana Loki / Docker logs)
  console.log(JSON.stringify(fullEntry));

  // Отправка в Sentry если уровень лога error
  reportToSentry(fullEntry);

  // Асинхронное сохранение в PostgreSQL (Prisma AuditLog)
  if (typeof window === "undefined") {
    Promise.resolve().then(async () => {
      try {
        let mappedAction: AuditAction = AuditAction.UPDATE;
        const actUpper = (entry.action || "").toUpperCase();
        if (actUpper.includes("CREATE")) mappedAction = AuditAction.CREATE;
        else if (actUpper.includes("DELETE") || actUpper.includes("REMOVE")) mappedAction = AuditAction.DELETE;
        else if (actUpper.includes("APPROVE")) mappedAction = AuditAction.APPROVE;
        else if (actUpper.includes("REJECT")) mappedAction = AuditAction.REJECT;
        else if (actUpper.includes("LOGIN")) mappedAction = AuditAction.LOGIN;
        else if (actUpper.includes("EXPORT")) mappedAction = AuditAction.EXPORT;

        await prisma.auditLog.create({
          data: {
            actorId: entry.userId || null,
            actorEmail: entry.userEmail || null,
            action: mappedAction,
            entityType: entry.module || "SYSTEM",
            entityId: (entry.details?.targetId as string) || (entry.details?.id as string) || "N/A",
            metadata: (entry.details as Prisma.InputJsonValue) || {},
            ipAddress: entry.ip || null,
            requestId: requestId,
            createdAt: new Date(),
          },
        });
      } catch (err) {
        console.error("[AuditLog Logger] Error persisting log to Prisma:", err);
      }
    });

    auditLogMemory.unshift(fullEntry);
    if (auditLogMemory.length > 100) auditLogMemory.pop();
  }

  return fullEntry;
}
