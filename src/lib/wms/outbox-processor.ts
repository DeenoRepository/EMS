import { prisma } from "@/lib/db/prisma";
import { ShellEventBus } from "@/lib/shell/event-bus";
import { eventBus } from "@/lib/events/event-bus";
import { Prisma } from "@prisma/client";

export interface CreateOutboxEventParams {
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

/**
 * Записывает доменное событие в таблицу WmsOutboxEvent в рамках существующей транзакции Prisma
 */
export async function recordWmsOutboxEvent(
  tx: Prisma.TransactionClient,
  params: CreateOutboxEventParams
) {
  return await tx.wmsOutboxEvent.create({
    data: {
      eventName: params.eventName,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      payload: params.payload as Prisma.InputJsonValue,
      status: "PENDING",
    },
  });
}

/**
 * Обрабатывает пачку не отправленных событий из WmsOutboxEvent (Transactional Outbox pattern)
 */
export async function processWmsOutboxEvents(batchSize: number = 50) {
  const pendingEvents = await prisma.wmsOutboxEvent.findMany({
    where: {
      status: "PENDING",
      retryCount: { lt: 5 },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  if (pendingEvents.length === 0) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const event of pendingEvents) {
    try {
      const payloadObj = (typeof event.payload === "object" && event.payload !== null)
        ? (event.payload as Record<string, unknown>)
        : { raw: event.payload };

      // 1. Публикация в системную шину ShellEventBus
      await ShellEventBus.publish(
        event.eventName,
        "WMS",
        payloadObj,
        event.id
      );

      // 2. Публикация в eventBus для срабатывания подписок Webhook
      eventBus.publish(
        "wms",
        event.eventName,
        payloadObj,
        (payloadObj.performedBy as string) || "SYSTEM"
      );

      // 3. Отмечаем событие как успешно обработанное
      await prisma.wmsOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });

      processed++;
    } catch (err) {
      failed++;
      console.error(`[WmsOutboxProcessor] Error processing event ${event.id}:`, err);

      await prisma.wmsOutboxEvent.update({
        where: { id: event.id },
        data: {
          retryCount: { increment: 1 },
          lastError: String(err),
          status: event.retryCount >= 4 ? "FAILED" : "PENDING",
        },
      });
    }
  }

  return { processed, failed };
}
