# Webhooks

> **Версия:** 2.4.0
> **Обновлено:** 2026-08-13 — добавлены секции по Redis, LDAP, HTTPS, OpenTelemetry  
> **Расположение кода:** [`src/lib/webhooks/webhook-service.ts`](../../src/lib/webhooks/webhook-service.ts)

---

## 1. Обзор

Webhook'и позволяют EMS отправлять доменные события во внешние системы (1С, SAP, ERP, CRM и т.д.) в реальном времени.

```
┌─────────────────────────────────────────────────────────────┐
│                    Webhook Flow                             │
│                                                             │
│  Domain Event                                               │
│       ↓                                                     │
│  ┌─────────────────┐                                        │
│  │  Event Bus      │                                        │
│  └─────────────────┘                                        │
│       ↓                                                     │
│  ┌─────────────────┐                                        │
│  │ Webhook Service │ ← подписан на "*"                      │
│  └─────────────────┘                                        │
│       ↓                                                     │
│  ┌─────────────────┐                                        │
│  │ Subscriptions   │ - targetUrl                            │
│  │                 │ - secretKey                            │
│  │                 │ - subscribedEvents                     │
│  └─────────────────┘                                        │
│       ↓                                                     │
│  ┌─────────────────┐                                        │
│  │ HTTP POST       │ + HMAC SHA-256 signature               │
│  │ + Headers       │ + X-EMS-* headers                      │
│  └─────────────────┘                                        │
│       ↓                                                     │
│  External System (1C, SAP, etc.)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Структура подписки

```typescript
interface WebhookSubscription {
  id: string;                    // "wh_1234567890_abc"
  name: string;                  // "1C ERP Integration"
  targetUrl: string;             // "https://erp.company.local/webhook/ems"
  secretKey: string;             // "shared-secret-for-hmac"
  subscribedEvents: string[];    // ["*"] или ["eps.equipment.created", "wms.stock.received"]
  isActive: boolean;             // true
  createdAt: string;             // ISO 8601
}
```

---

## 3. API

### 3.1. Регистрация webhook'а

```typescript
import { registerWebhook } from "@/lib/webhooks/webhook-service";

const subscription = registerWebhook({
  name: "1C ERP Integration",
  targetUrl: "https://erp.company.local/api/webhook/ems",
  secretKey: process.env.WEBHOOK_SECRET_1C!,
  subscribedEvents: [
    "eps.equipment.created",
    "eps.equipment.updated",
    "wms.stock.received",
    "wms.stock.issued"
  ],
  isActive: true
});
```

### 3.2. Получение списка webhook'ов

```typescript
import { getWebhooks } from "@/lib/webhooks/webhook-service";

const webhooks = getWebhooks();
```

### 3.3. Генерация подписи

```typescript
import { generateWebhookSignature } from "@/lib/webhooks/webhook-service";

const payload = JSON.stringify({ eventType: "eps.equipment.created", ... });
const signature = generateWebhookSignature(payload, secretKey);
// "a1b2c3d4e5f6..."
```

---

## 4. Формат запроса

### 4.1. HTTP Headers

```
Content-Type: application/json
X-EMS-Signature: a1b2c3d4e5f6...          # HMAC SHA-256
X-EMS-Event: eps.equipment.created         # Тип события
X-EMS-Event-Id: evt_1234567890_abc         # ID события
User-Agent: EMS-Webhook-Dispatcher/2.3
```

### 4.2. Body (JSON)

```json
{
  "eventId": "evt_1234567890_abc",
  "eventType": "eps.equipment.created",
  "sourceModule": "EPS",
  "timestamp": "2026-08-12T15:00:00.000Z",
  "correlationId": "corr_1234567890",
  "payload": {
    "equipmentId": "eq_123",
    "equipmentCode": "EQ-001",
    "name": "Пресс гидравлический",
    "performedBy": "usr-editor"
  }
}
```

### 4.3. Подпись (HMAC SHA-256)

```typescript
import crypto from "crypto";

function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
```

**Проверка на стороне получателя (Python пример):**

```python
import hmac
import hashlib

def verify_webhook(payload: str, signature: str, secret: str) -> **Версия:** 2.4.0
> bool:
    expected = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

---

## 5. Подписки на события

### 5.1. Wildcard (`*`)

Подписка на все события:

```typescript
registerWebhook({
  name: "Audit Logger",
  targetUrl: "https://audit.company.local/webhook",
  secretKey: "...",
  subscribedEvents: ["*"],
  isActive: true
});
```

### 5.2. Конкретные события

```typescript
registerWebhook({
  name: "1C Equipment Sync",
  targetUrl: "https://erp.company.local/api/equipment",
  secretKey: "...",
  subscribedEvents: [
    "eps.equipment.created",
    "eps.equipment.updated",
    "eps.equipment.deleted"
  ],
  isActive: true
});
```

### 5.3. Паттерны (опционально)

Поддержка паттернов через префиксы:

```typescript
// Все события EPS
subscribedEvents: ["eps.*"]

// Все события WMS
subscribedEvents: ["wms.*"]
```

---

## 6. Доставка и retry

### 6.1. Timeout

Каждый запрос имеет timeout 5 секунд:

```typescript
const response = await fetch(sub.targetUrl, {
  method: "POST",
  headers: { ... },
  body: bodyStr,
  signal: AbortSignal.timeout(5000)
});
```

### 6.2. Обработка ошибок

```typescript
async function dispatchWebhook(sub: WebhookSubscription, payload: SystemEventPayload) {
  try {
    const response = await fetch(sub.targetUrl, { ... });
    
    logEvent({
      level: response.ok ? "info" : "warn",
      module: "WEBHOOKS",
      action: "DISPATCH_WEBHOOK",
      details: { 
        webhookId: sub.id, 
        eventType: payload.eventType, 
        statusCode: response.status 
      }
    });
  } catch (err) {
    console.error(`[Webhook Dispatch Error] Failed to deliver ${payload.eventType} to ${sub.targetUrl}:`, err);
    
    logEvent({
      level: "error",
      module: "WEBHOOKS",
      action: "DISPATCH_WEBHOOK_FAILED",
      details: { 
        webhookId: sub.id, 
        targetUrl: sub.targetUrl, 
        error: String(err) 
      }
    });
  }
}
```

### 6.3. Retry (опционально)

Для критичных webhook'ов можно реализовать retry с exponential backoff:

```typescript
async function dispatchWithRetry(sub: WebhookSubscription, payload: SystemEventPayload, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(sub.targetUrl, { ... });
      if (response.ok) return;
      
      if (attempt === maxRetries) {
        // Сохранить в dead letter queue
        await saveToDeadLetterQueue(sub, payload);
      }
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => **Версия:** 2.4.0
> setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}
```

---

## 7. Безопасность

### 7.1. HMAC подпись

Каждый запрос подписывается HMAC SHA-256. Получатель должен проверить подпись перед обработкой.

### 7.2. HTTPS

Webhook'и должны отправляться только на HTTPS endpoints (кроме localhost для разработки).

### 7.3. IP Whitelist (опционально)

Для критичных интеграций можно ограничить IP-адреса получателей.

### 7.4. Secret Rotation

Реализовать ротацию `secretKey` без простоя:

```typescript
// Поддержка двух активных секретов
interface WebhookSubscription {
  secretKey: string;        // Текущий
  previousSecretKey?: string; // Предыдущий (для ротации)
}
```

---

## 8. Мониторинг

### 8.1. Логирование

Все отправки логируются через `logEvent()`:

```typescript
logEvent({
  level: response.ok ? "info" : "warn",
  module: "WEBHOOKS",
  action: "DISPATCH_WEBHOOK",
  details: { 
    webhookId: sub.id, 
    eventType: payload.eventType, 
    statusCode: response.status,
    duration: Date.now() - startTime
  }
});
```

### 8.2. Метрики

- Количество успешных доставок
- Количество неудач
- Среднее время доставки
- Количество активных подписок

### 8.3. Dead Letter Queue

Для неудачных доставок можно реализовать DLQ:

```typescript
model WebhookDeadLetter {
  id          String   @id @default(cuid())
  webhookId   String
  payload     Json
  lastError   String
  retryCount  Int
  createdAt   DateTime @default(now())
  
  @@index([webhookId, createdAt])
}
```

---

## 9. Примеры интеграций

### 9.1. 1С:ERP

```typescript
registerWebhook({
  name: "1C ERP Equipment Sync",
  targetUrl: "https://erp.company.local/api/ems/equipment",
  secretKey: process.env.WEBHOOK_1C_SECRET!,
  subscribedEvents: [
    "eps.equipment.created",
    "eps.equipment.updated",
    "eps.equipment.deleted"
  ],
  isActive: true
});
```

### 9.2. SAP PM

```typescript
registerWebhook({
  name: "SAP PM Notifications",
  targetUrl: "https://sap.company.local/ems/notifications",
  secretKey: process.env.WEBHOOK_SAP_SECRET!,
  subscribedEvents: [
    "eps.equipment.status_changed",
    "wms.stock.received",
    "wms.writeoff.created"
  ],
  isActive: true
});
```

### 9.3. Telegram Bot

```typescript
registerWebhook({
  name: "Telegram Notifications",
  targetUrl: "https://api.telegram.org/bot<TOKEN> **Версия:** 2.4.0
>/sendMessage",
  secretKey: "telegram-webhook-secret",
  subscribedEvents: [
    "eps.approval.submitted",
    "wms.stock.low"
  ],
  isActive: true
});
```

---

## 10. Тестирование

### 10.1. Локальный тестовый endpoint

```typescript
// scripts/test-webhook-receiver.ts
import express from "express";

const app = express();
app.use(express.json());

app.post("/webhook", (req, res) => **Версия:** 2.4.0
> {
  const signature = req.headers["x-ems-signature"];
  const event = req.headers["x-ems-event"];
  
  console.log("Received webhook:");
  console.log("Event:", event);
  console.log("Signature:", signature);
  console.log("Body:", req.body);
  
  res.status(200).json({ received: true });
});

app.listen(3001, () => **Версия:** 2.4.0
> console.log("Test webhook receiver on :3001"));
```

### 10.2. Отправка тестового события

```typescript
import { ShellEventBus } from "@/lib/shell/event-bus";

await ShellEventBus.publish(
  "test.webhook",
  "TEST",
  { message: "Hello from EMS" },
  "test_corr_123"
);
```

---

## 11. Лучшие практики

✅ **Делать:**
- Использовать HTTPS для production webhook'ов
- Проверять HMAC подпись на стороне получателя
- Использовать уникальные secretKey для каждого webhook'а
- Логировать все отправки и ошибки
- Реализовать retry для критичных webhook'ов
- Документировать payload событий для получателей

❌ **Не делать:**
- Не отправлять чувствительные данные (пароли, токены)
- Не использовать HTTP для production
- Не игнорировать ошибки доставки
- Не хранить secretKey в коде (использовать env)
- Не отправлять большие payload (> **Версия:** 2.4.0
> 1 MB)

---

## 12. Миграция с in-memory на БД

Текущая реализация хранит подписки в памяти. Для production рекомендуется вынести в БД:

```prisma
model WebhookSubscription {
  id              String   @id @default(cuid())
  name            String
  targetUrl       String
  secretKey       String   // Зашифровать!
  subscribedEvents String[]
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([isActive])
}
```

```typescript
// Загрузка подписок из БД при старте
async function loadSubscriptions() {
  const subs = await prisma.webhookSubscription.findMany({
    where: { isActive: true }
  });
  
  for (const sub of subs) {
    registerWebhook({
      name: sub.name,
      targetUrl: sub.targetUrl,
      secretKey: decrypt(sub.secretKey),
      subscribedEvents: sub.subscribedEvents,
      isActive: sub.isActive
    });
  }
}
```

---

## 6. Redis Storage (v2.4.0)

Начиная с версии 2.4.0 webhook подписки хранятся в Redis для работы в multi-instance окружениях.

### 6.1. Структура хранения

```
Redis Keys:
  webhook:sub:{id}     → JSON подписки (TTL 90 дней)
  webhook:index        → SET со списком всех ID подписок
```

### 6.2. API изменения

- `registerWebhook()` теперь async
- `getWebhooks()` теперь async
- Добавлен `unregisterWebhook(id)` для удаления подписок

### 6.3. Fallback

В development без Redis используется in-memory Map. В production Redis обязателен.
