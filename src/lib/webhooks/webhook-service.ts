import crypto from "crypto";
import { eventBus, SystemEventPayload } from "@/lib/events/event-bus";
import { logEvent } from "@/lib/telemetry/logger";

export interface WebhookSubscription {
  id: string;
  name: string;
  targetUrl: string;
  secretKey: string;
  subscribedEvents: string[]; // e.g. ["EQUIPMENT_CREATED", "WMS_MOVEMENT_CREATED"]
  isActive: boolean;
  createdAt: string;
}

// In-Memory реестр подписок (с поддержкой загрузки из БД или конфига)
const subscriptions: WebhookSubscription[] = [];

/**
 * Регистрирует новый Webhook для внешней системы (например, 1C ERP)
 */
export function registerWebhook(sub: Omit<WebhookSubscription, "id" | "createdAt">): WebhookSubscription {
  const newSub: WebhookSubscription = {
    id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...sub
  };
  subscriptions.push(newSub);

  logEvent({
    level: "info",
    module: "WEBHOOKS",
    action: "REGISTER_WEBHOOK",
    details: { webhookId: newSub.id, targetUrl: newSub.targetUrl, events: newSub.subscribedEvents }
  });

  return newSub;
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
        "User-Agent": "EMS-Webhook-Dispatcher/2.3"
      },
      body: bodyStr,
      signal: AbortSignal.timeout(5000)
    });

    logEvent({
      level: response.ok ? "info" : "warn",
      module: "WEBHOOKS",
      action: "DISPATCH_WEBHOOK",
      details: { webhookId: sub.id, eventType: payload.eventType, statusCode: response.status }
    });
  } catch (err) {
    console.error(`[Webhook Dispatch Error] Failed to deliver ${payload.eventType} to ${sub.targetUrl}:`, err);
    logEvent({
      level: "error",
      module: "WEBHOOKS",
      action: "DISPATCH_WEBHOOK_FAILED",
      details: { webhookId: sub.id, targetUrl: sub.targetUrl, error: String(err) }
    });
  }
}

// Автоматическая подписка диспатчера на шину событий System Event Bus
eventBus.subscribe("*", (payload: SystemEventPayload) => {
  const activeSubs = subscriptions.filter(
    (s) => s.isActive && (s.subscribedEvents.includes("*") || s.subscribedEvents.includes(payload.eventType))
  );

  activeSubs.forEach((sub) => {
    dispatchWebhook(sub, payload).catch(() => {});
  });
});

export function getWebhooks(): WebhookSubscription[] {
  return subscriptions;
}
