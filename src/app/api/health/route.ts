import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

/**
 * GET /api/health
 *
 * Публичный health check endpoint (SEC-05).
 * Возвращает минимальную информацию для load balancer / Kubernetes.
 *
 * ⚠️  НЕ раскрывает:
 * - Версию приложения
 * - Детальную информацию о сервисах
 * - Метрики производительности
 *
 * Для детальной информации используйте /api/health/detailed (только ADMIN).
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  let isHealthy = true;

  // Минимальная проверка БД
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    isHealthy = false;
  }

  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp,
    },
    { status: statusCode }
  );
}
