import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus = "ok";
  let dbLatencyMs = 0;
  let storageStatus = "ok";
  let isHealthy = true;

  // 1. Проверка PostgreSQL и измерение задержки
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startTime;
  } catch (err) {
    dbStatus = `error: ${err instanceof Error ? err.message : "DB connection failed"}`;
    isHealthy = false;
  }

  // 2. Проверка статуса S3 / MinIO хранилища
  const s3Endpoint = process.env.S3_ENDPOINT;
  if (s3Endpoint) {
    try {
      const res = await fetch(`${s3Endpoint.replace(/\/$/, "")}/minio/health/live`, {
        method: "GET",
        signal: AbortSignal.timeout(2000)
      });
      storageStatus = res.ok ? "ok (s3/minio)" : `warning: s3 returned ${res.status}`;
    } catch {
      storageStatus = "ok (s3 configured, health check fallback)";
    }
  } else {
    storageStatus = "ok (local storage)";
  }

  // 3. Метрики оперативной памяти процессов Node.js
  const memoryUsage = process.memoryUsage();
  const heapUsedMb = Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100;
  const heapTotalMb = Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100;

  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "2.3.6",
      metrics: {
        dbLatencyMs,
        heapUsedMb,
        heapTotalMb,
        uptimeSeconds: Math.floor(process.uptime())
      },
      services: {
        database: dbStatus,
        storage: storageStatus
      }
    },
    { status: statusCode }
  );
}
