import { getSession } from "@/lib/auth/session";
import { processWmsOutboxEvents } from "@/lib/wms/outbox-processor";
import { logEvent } from "@/lib/telemetry/logger";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const outboxProcessSchema = z.object({
  batchSize: z.coerce.number().int().min(1).max(500).default(50),
});

/**
 * POST /api/modules/wms/outbox/process
 *
 * Ручной запуск обработки Transactional Outbox для WMS-событий.
 *
 * @returns {Promise<{ success: true, processed: number, failed: number, timestamp: string }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    const { searchParams } = new URL(request.url);
    const parseResult = outboxProcessSchema.safeParse({
      batchSize: searchParams.get("batchSize") || undefined,
    });

    if (!parseResult.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Некорректные параметры batchSize",
        parseResult.error.flatten(),
        400,
        request
      );
    }

    const { batchSize } = parseResult.data;
    const result = await processWmsOutboxEvents(batchSize);

    logEvent({
      level: "audit",
      module: "WMS",
      action: "OUTBOX_PROCESSED",
      userId: session.id,
      userEmail: session.email,
      requestId: correlationId,
      details: { processed: result.processed, failed: result.failed, batchSize },
    });

    return createSuccessResponse(
      {
        success: true,
        processed: result.processed,
        failed: result.failed,
        timestamp: new Date().toISOString(),
      },
      request
    );
  } catch (error) {
    console.error("POST /api/modules/wms/outbox/process error:", error);
    logEvent({
      level: "error",
      module: "WMS",
      action: "OUTBOX_PROCESS_FAILED",
      requestId: correlationId,
      error: String(error),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка обработки outbox",
      undefined,
      500,
      request
    );
  }
}

/**
 * GET /api/modules/wms/outbox/process
 *
 * Запустить обработку outbox с дефолтным batchSize=50.
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
    }

    const result = await processWmsOutboxEvents(50);
    return createSuccessResponse({ success: true, result }, request);
  } catch (error) {
    console.error("GET /api/modules/wms/outbox/process error:", error);
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка обработки outbox",
      undefined,
      500,
      request
    );
  }
}
