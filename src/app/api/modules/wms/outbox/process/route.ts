import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { processWmsOutboxEvents } from "@/lib/wms/outbox-processor";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const batchSize = parseInt(searchParams.get("batchSize") || "50", 10);

    const result = await processWmsOutboxEvents(batchSize);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("POST /api/modules/wms/outbox/process error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processWmsOutboxEvents(50);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("GET /api/modules/wms/outbox/process error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
