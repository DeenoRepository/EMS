export type LogLevel = "info" | "warn" | "error" | "audit";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  action: string;
  userId?: string;
  userEmail?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

export function logEvent(entry: Omit<LogEntry, "timestamp">) {
  const fullEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    ...entry
  };

  // Вывод структурированного JSON лога
  console.log(JSON.stringify(fullEntry));

  // Сохранение во временное локальное хранилище аудита (для вывода в UI)
  if (typeof window === "undefined") {
    auditLogMemory.unshift(fullEntry);
    if (auditLogMemory.length > 100) auditLogMemory.pop();
  }

  return fullEntry;
}

export const auditLogMemory: LogEntry[] = [];
