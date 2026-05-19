type Level = "info" | "warn" | "error";

function base(level: Level, message: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta || {})
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
    return;
  }
  if (level === "warn") {
    console.warn(JSON.stringify(entry));
    return;
  }
  console.log(JSON.stringify(entry));
}

export const log = {
  info: (message: string, meta?: Record<string, unknown>) => base("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => base("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => base("error", message, meta)
};
