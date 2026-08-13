/**
 * Prisma client singleton for server-side DB access.
 *
 * Features:
 * - Lazy initialization (crash only at query-time, not at module-load)
 * - Graceful shutdown (handles SIGTERM, SIGINT, beforeExit)
 * - Connection pooling via DATABASE_URL parameters
 * - Logging configuration per environment
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : process.env.NODE_ENV === "test"
          ? ["error"]
          : ["error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown для Prisma (CODE-03)
 *
 * Корректно закрывает соединения с БД при получении сигналов завершения.
 * Предотвращает потерю соединений и утечки ресурсов.
 */
let shutdownRegistered = false;

function registerShutdownHandlers() {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  const shutdown = async (signal: string) => {
    console.log(`[Prisma] Received ${signal}, disconnecting...`);
    try {
      await prisma.$disconnect();
      console.log("[Prisma] Disconnected successfully");
    } catch (err) {
      console.error("[Prisma] Error during disconnect:", err);
    }
  };

  // Обработка сигналов завершения
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Обработка beforeExit (вызывается при нормальном завершении Node.js)
  process.on("beforeExit", async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });
}

// Регистрируем обработчики только в production и development
// В test окружении управляем жизненным циклом вручную
if (process.env.NODE_ENV !== "test") {
  registerShutdownHandlers();
}

/**
 * Принудительное закрытие соединений (для тестов и graceful shutdown)
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error("[Prisma] Disconnect error:", err);
  }
}
