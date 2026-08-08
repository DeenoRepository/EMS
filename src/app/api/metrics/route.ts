import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  let dbStatusGauge = 1;
  const startTime = Date.now();
  let dbLatencyMs = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startTime;
  } catch {
    dbStatusGauge = 0;
  }

  const mem = process.memoryUsage();
  const uptime = Math.floor(process.uptime());

  // Формат exposition format для Prometheus Scraper
  const metricsText = [
    `# HELP ems_up Status of EMS application (1 = up, 0 = down)`,
    `# TYPE ems_up gauge`,
    `ems_up 1`,
    ``,
    `# HELP ems_database_up Database connection status (1 = connected, 0 = disconnected)`,
    `# TYPE ems_database_up gauge`,
    `ems_database_up ${dbStatusGauge}`,
    ``,
    `# HELP ems_database_latency_milliseconds Database query latency in milliseconds`,
    `# TYPE ems_database_latency_milliseconds gauge`,
    `ems_database_latency_milliseconds ${dbLatencyMs}`,
    ``,
    `# HELP ems_node_heap_bytes Node.js heap memory usage in bytes`,
    `# TYPE ems_node_heap_bytes gauge`,
    `ems_node_heap_bytes{type="used"} ${mem.heapUsed}`,
    `ems_node_heap_bytes{type="total"} ${mem.heapTotal}`,
    ``,
    `# HELP ems_process_uptime_seconds Process uptime in seconds`,
    `# TYPE ems_process_uptime_seconds counter`,
    `ems_process_uptime_seconds ${uptime}`
  ].join("\n");

  return new NextResponse(metricsText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8"
    }
  });
}
