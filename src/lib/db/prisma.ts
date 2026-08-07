/**
 * Prisma client singleton for server-side DB access.
 *
 * Uses lazy initialization so that a missing `prisma generate` or absent
 * DATABASE_URL crashes only at query-time (inside a try/catch in the route),
 * not at module-load time (which would produce an unrecoverable 500 before
 * any route handler logic runs).
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
