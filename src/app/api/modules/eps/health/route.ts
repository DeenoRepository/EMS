import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    // Реальная проверка соединения с PostgreSQL
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "healthy",
      module: "EPS",
      db: "connected",
      version: "1.3.0",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        module: "EPS",
        db: "disconnected",
        error: error instanceof Error ? error.message : "Database connection failed",
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
