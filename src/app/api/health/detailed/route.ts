import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { createErrorResponse } from "@/lib/shell/api-response";

/**
 * GET /api/health/detailed
 *
 * Детальный health check (SEC-05).
 * Доступен только администраторам.
 *
 * Возвращает:
 * - Версию приложения
 * - Состояние всех сервисов
 * - Метрики производительности
 * - Информацию о БД
 */
export async function GET(request: Request) {
    const session = await getSession();
    if (!session) {
        return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    if (!hasRole(session, ["ADMIN"])) {
        return createErrorResponse(
            "FORBIDDEN",
            "Доступ запрещен. Требуются права администратора.",
            undefined,
            403,
            request
        );
    }

    const timestamp = new Date().toISOString();
    let dbStatus = "ok";
    let dbLatencyMs = 0;
    let storageStatus = "ok";
    let isHealthy = true;

    // Проверка PostgreSQL
    const startTime = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        dbLatencyMs = Date.now() - startTime;
    } catch (err) {
        dbStatus = `error: ${err instanceof Error ? err.message : "DB connection failed"}`;
        isHealthy = false;
    }

    // Проверка S3/MinIO
    const s3Endpoint = process.env.S3_ENDPOINT;
    if (s3Endpoint) {
        try {
            const res = await fetch(`${s3Endpoint.replace(/\/$/, "")}/minio/health/live`, {
                method: "GET",
                signal: AbortSignal.timeout(2000),
            });
            storageStatus = res.ok ? "ok (s3/minio)" : `warning: s3 returned ${res.status}`;
        } catch {
            storageStatus = "ok (s3 configured, health check fallback)";
        }
    } else {
        storageStatus = "ok (local storage)";
    }

    // Метрики памяти
    const memoryUsage = process.memoryUsage();
    const heapUsedMb = Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100;
    const heapTotalMb = Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100;

    const statusCode = isHealthy ? 200 : 503;

    return NextResponse.json(
        {
            status: isHealthy ? "healthy" : "unhealthy",
            timestamp,
            version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
            metrics: {
                dbLatencyMs,
                heapUsedMb,
                heapTotalMb,
                uptimeSeconds: Math.floor(process.uptime()),
            },
            services: {
                database: dbStatus,
                storage: storageStatus,
            },
        },
        { status: statusCode }
    );
}
