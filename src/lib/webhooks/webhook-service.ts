/**
 * Webhook Service (SEC-03)
 *
 * Реестр webhook подписок с хранением в Redis для работы в multi-instance окружениях.
 * Fallback на in-memory для development/test.
 */
import crypto from "crypto";
import { eventBus, SystemEventPayload } from "@/lib/events/event-bus";
import { logEvent } from "@/lib/telemetry/logger";
import { getRedis } from "@/lib/db/redis";

export interface WebhookSubscription {
  id: string;
  name: string;
  targetUrl: string;
  secretKey: string;
  subscribedEvents: string[]; // e.g. ["EQUIPMENT_CREATED", "WMS_MOVEMENT_CREATED"]
  isActive: boolean;
  createdAt: string;
}

const WEBHOOK_PREFIX = "webhook:sub:";
const WEBHOOK_INDEX = "webhook:index"; // SET со списком всех ID
const WEBHOOK_TTL = 90 * 24 * 60 * 60; // 90 дней по умолчанию

/**
 * In-memory fallback для development
 */
const memoryFallback = new Map<string, WebhookSubscription>();

/**
 * Загрузить все подписки из Redis (или fallback)
 */
async function loadAllSubscriptions(): Promise<WebhookSubscription[]> {
  const redis = getRedis();

  if (redis) {
    try {
      const ids = await redis.smembers(WEBHOOK_INDEX);
      if (ids.length === 0) return [];

      const keys = ids.map((id: string) => `${WEBHOOK_PREFIX}${id}`);
      const values = await redis.mget(...keys);

      const subs: WebhookSubscription[] = [];
      for (const v of values) {
        if (v) {
          try {
            subs.push(JSON.parse(v) as WebhookSubscription);
          } catch {
            // skip corrupted entry
          }
        }
      }
      return subs;
    } catch (err) {
      console.error("[Webhook] Failed to load subscriptions from Redis:", err);
      return Array.from(memoryFallback.values());
    }
  }

  return Array.from(memoryFallback.values());
}

/**
 * Сохранить подписку в Redis (или fallback)
 */
async function saveSubscription(sub: WebhookSubscription): Promise<void> {
  const redis = getRedis();

  if (redis) {
    try {
      const key = `${WEBHOOK_PREFIX}${sub.id}`;
      await redis.set(key, JSON.stringify(sub), "EX", WEBHOOK_TTL);
      await redis.sadd(WEBHOOK_INDEX, sub.id);
      // TTL на индекс не ставим — он пересоздаётся автоматически
    } catch (err) {
      console.error("[Webhook] Failed to save subscription to Redis:", err);
    }
  }

  // Всегда дублируем в memory fallback для быстрого доступа
  memoryFallback.set(sub.id, sub);
}

/**
 * Удалить подписку из Redis (или fallback)
 */
async function deleteSubscription(id: string): Promise<void> {
  const redis = getRedis();

  if (redis) {
    try {
      await redis.del(`${WEBHOOK_PREFIX}${id}`);
      await redis.srem(WEBHOOK_INDEX, id);
    } catch (err) {
      console.error("[Webhook] Failed to delete subscription from Redis:", err);
    }
  }

  memoryFallback.delete(id);
}

/**
 * Регистрирует новый Webhook для внешней системы (например, 1C ERP)
 */
export async function registerWebhook(
  sub: Omit<WebhookSubscription, "id" | "createdAt">
): Promise<WebhookSubscription> {
  const newSub: WebhookSubscription = {
    id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...sub,
  };

  await saveSubscription(newSub);

  logEvent({
    level: "info",
    module: "WEBHOOKS",
    action: "REGISTER_WEBHOOK",
    details: { webhookId: newSub.id, targetUrl: newSub.targetUrl, events: newSub.subscribedEvents },
  });

  return newSub;
}

/**
 * Удалить webhook подписку
 */
export async function unregisterWebhook(id: string): Promise<boolean> {
  await deleteSubscription(id);

  logEvent({
    level: "info",
    module: "WEBHOOKS",
    action: "UNREGISTER_WEBHOOK",
    details: { webhookId: id },
  });

  return true;
}

/**
 * Генерирует HMAC SHA-256 подпись тела запроса для валидации на стороне получателя
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Отправляет событие по HTTP POST всем подпискам
 */
async function dispatchWebhook(sub: WebhookSubscription, payload: SystemEventPayload) {
  try {
    const bodyStr = JSON.stringify(payload);
    const signature = generateWebhookSignature(bodyStr, sub.secretKey);

    const response = await fetch(sub.targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-EMS-Signature": signature,
        "X-EMS-Event": payload.eventType,
        "X-EMS-Event-Id": payload.eventId,
        "User-Agent": "EMS-Webhook-Dispatcher/2.3",
      },
      body: bodyStr,
      signal: AbortSignal.timeout(5000),
    });

    logEvent({
      level: response.ok ? "info" : "warn",
      module: "WEBHOOKS",
      action: "DISPATCH_WEBHOOK",
      details: { webhookId: sub.id, eventType: payload.eventType, statusCode: response.status },
    });
  } catch (err) {
    console.error(`[Webhook Dispatch Error] Failed to deliver ${payload.eventType} to ${sub.targetUrl}:`, err);
    logEvent({
      level: "error",
      module: "WEBHOOKS",
      action: "DISPATCH_WEBHOOK_FAILED",
      details: { webhookId: sub.id, targetUrl: sub.targetUrl, error: String(err) },
    });
  }
}

// Автоматическая подписка диспатчера на шину событий System Event Bus
eventBus.subscribe("*", async (payload: SystemEventPayload) => {
  try {
    const allSubs = await loadAllSubscriptions();
    const activeSubs = allSubs.filter(
      (s) => s.isActive && (s.subscribedEvents.includes("*") || s.subscribedEvents.includes(payload.eventType))
    );

    activeSubs.forEach((sub) => {
      dispatchWebhook(sub, payload).catch(() => { });
    });
  } catch (err) {
    console.error("[Webhook] Failed to load subscriptions for dispatch:", err);
  }
});

/**
 * Получить список всех webhook подписок
 */
export async function getWebhooks(): Promise<WebhookSubscription[]> {
  return await loadAllSubscriptions();
}
