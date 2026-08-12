# Event Bus

> **Версия:** 2.3.7  
> **Расположение кода:** [`src/lib/shell/event-bus.ts`](../../src/lib/shell/event-bus.ts), [`src/lib/events/event-bus.ts`](../../src/lib/events/event-bus.ts), [`src/lib/wms/outbox-processor.ts`](../../src/lib/wms/outbox-processor.ts)

---

## 1. Обзор

EMS использует **двухуровневую систему событий**:

1. **ShellEventBus** ([`src/lib/shell/event-bus.ts`](../../src/lib/shell/event-bus.ts)) — in-process pub/sub для real-time коммуникации
2. **Transactional Outbox** ([`src/lib/wms/outbox-processor.ts`](../../src/lib/wms/outbox-processor.ts)) — гарантированная доставка событий через БД

```
┌─────────────────────────────────────────────────────────────┐
│                    Event Flow                               │
│                                                             │
│  Business Operation                                         │
│         ↓                                                   │
│  ┌─────────────────┐                                        │
│  │ Prisma TX       │                                        │
│  │  - Update DB    │                                        │
│  │  - Insert       │                                        │
│  │    OutboxEvent  │                                        │
│  └─────────────────┘                                        │
│         ↓                                                   │
│  ┌─────────────────┐                                        │
│  │ OutboxProcessor │ (cron / manual trigger)                │
│  └─────────────────┘                                        │
│         ↓                                                   │
│  ┌─────────────────┐                                        │
│  │ ShellEventBus   │ ← in-process pub/sub                   │
│  └─────────────────┘                                        │
│         ↓                                                   │
│  ┌─────────────────┐                                        │
│  │ Subscribers     │ - Webhook dispatcher                   │
│  │                 │ - SSE clients (UI)                     │
│  │                 │ - Other modules                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ShellEventBus

### 2.1. Назначение

In-process pub/sub для real-time коммуникации между модулями и UI. Поддерживает:
- Подписку на конкретные события
- Подписку на все события (wildcard `*`)
- SSE-клиенты для real-time UI обновлений
- Изоляцию ошибок в handler'ах

### 2.2. API

#### Публикация события

```typescript
import { ShellEventBus } from "@/lib/shell/event-bus";

await ShellEventBus.publish(
  "eps.equipment.created",  // eventName
  "EPS",                    // sourceModule
  {                         // payload
    equipmentId: "eq_123",
    code: "EQ-001",
    name: "Пресс гидравлический"
  },
  "corr_1234567890"         // correlationId (опционально)
);
```

#### Подписка на событие

```typescript
import { ShellEventBus } from "@/lib/shell/event-bus";

const unsubscribe = ShellEventBus.subscribe(
  "eps.equipment.created",
  async (event) => {
    console.log("Equipment created:", event.payload);
    // Обработка события
  }
);

// Отписка
unsubscribe();
```

#### Подписка на все события (wildcard)

```typescript
ShellEventBus.subscribe("*", async (event) => {
  console.log(`[${event.sourceModule}] ${event.name}:`, event.payload);
});
```

### 2.3. Структура события

```typescript
interface ShellEvent<T = Record<string, unknown>> {
  id: string;              // "evt_1234567890_abc"
  name: string;            // "eps.equipment.created"
  sourceModule: string;    // "EPS"
  payload: T;              // { equipmentId, code, name }
  timestamp: string;       // ISO 8601
  correlationId?: string;  // "corr_1234567890"
}
```

### 2.4. SSE-клиенты

ShellEventBus поддерживает SSE-подключения для real-time UI обновлений:

```typescript
// На стороне сервера (в API route)
import { ShellEventBus } from "@/lib/shell/event-bus";

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = ShellEventBus.addSseClient((event) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      });
      
      // Cleanup при закрытии соединения
      // ...
    }
  });
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
```

```typescript
// На стороне клиента
const eventSource = new EventSource("/api/shell/events/sse");

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received event:", data);
};
```

---

## 3. Transactional Outbox

### 3.1. Назначение

Гарантирует доставку доменных событий даже при сбоях. Событие записывается в БД в той же транзакции, что и бизнес-операция, а затем асинхронно обрабатывается.

### 3.2. Модель БД

```prisma
model WmsOutboxEvent {
  id            String          @id @default(cuid())
  eventName     String          // "wms.stock.received"
  aggregateType String          // "WmsItem"
  aggregateId   String          // "item_123"
  payload       Json            // { itemId, sku, quantity, ... }
  status        WmsOutboxStatus @default(PENDING)
  retryCount    Int             @default(0)
  lastError     String?
  createdAt     DateTime        @default(now())
  processedAt   DateTime?
  
  @@index([status, createdAt])
  @@index([eventName])
  @@index([aggregateId])
}

enum WmsOutboxStatus {
  PENDING
  PROCESSED
  FAILED
}
```

### 3.3. Запись события в транзакции

```typescript
import { prisma } from "@/lib/db/prisma";
import { recordWmsOutboxEvent } from "@/lib/wms/outbox-processor";

const result = await prisma.$transaction(async (tx) => {
  // 1. Бизнес-операция
  const item = await tx.wmsItem.update({
    where: { id: itemId },
    data: { quantity: newQuantity }
  });
  
  // 2. Запись события в outbox (в той же транзакции)
  await recordWmsOutboxEvent(tx, {
    eventName: "wms.stock.received",
    aggregateType: "WmsItem",
    aggregateId: item.id,
    payload: {
      itemId: item.id,
      sku: item.sku,
      quantity: receivedQty,
      totalQuantity: newQuantity,
      performedBy: sessionUser
    }
  });
  
  return item;
});
```

### 3.4. Обработка outbox

```typescript
import { processWmsOutboxEvents } from "@/lib/wms/outbox-processor";

// Обработать пачку событий (по умолчанию 50)
const result = await processWmsOutboxEvents(50);
// { processed: 42, failed: 2 }
```

**Логика обработки:**
1. Выбрать `PENDING` события с `retryCount < 5`
2. Для каждого события:
   - Опубликовать в `ShellEventBus`
   - Опубликовать в `eventBus` (для webhook'ов)
   - При успехе → `status = PROCESSED`
   - При ошибке → `retryCount++`, при `retryCount >= 5` → `status = FAILED`

### 3.5. Триггеры обработки

- **Cron** — периодический запуск через `ShellCronEngine`
- **API endpoint** — `/api/modules/wms/outbox/process` для ручного запуска
- **После записи** — опционально, для low-latency сценариев

---

## 4. Соглашения об именовании событий

### 4.1. Формат

```
{module}.{entity}.{action}
```

### 4.2. Примеры

| Событие | Модуль | Сущность | Действие |
|---------|--------|----------|----------|
| `eps.equipment.created` | EPS | equipment | created |
| `eps.equipment.updated` | EPS | equipment | updated |
| `eps.equipment.status_changed` | EPS | equipment | status_changed |
| `eps.document.attached` | EPS | document | attached |
| `eps.approval.submitted` | EPS | approval | submitted |
| `eps.approval.resolved` | EPS | approval | resolved |
| `wms.stock.received` | WMS | stock | received |
| `wms.stock.issued` | WMS | stock | issued |
| `wms.transfer.requested` | WMS | transfer | requested |
| `wms.transfer.approved` | WMS | transfer | approved |
| `wms.writeoff.created` | WMS | writeoff | created |
| `shell.module.degraded` | SHELL | module | degraded |
| `shell.module.restored` | SHELL | module | restored |

### 4.3. Действия (actions)

- `created` — создание сущности
- `updated` — обновление сущности
- `deleted` — удаление сущности
- `status_changed` — изменение статуса
- `submitted` — отправка на согласование
- `approved` / `rejected` — решение по согласованию
- `attached` / `detached` — прикрепление/открепление
- `received` / `issued` — складские операции
- `requested` / `completed` — заявки
- `degraded` / `restored` — состояние модулей

---

## 5. Payload событий

### 5.1. Рекомендуемая структура

```typescript
{
  // Идентификаторы
  entityId: string,
  entityType: string,
  
  // Контекст
  performedBy: string,        // ID или username
  performedByEmail?: string,
  
  // Данные
  // ...специфичные для события поля
  
  // Метаданные
  timestamp: string,          // ISO 8601
  correlationId?: string
}
```

### 5.2. Примеры payload

#### `eps.equipment.created`
```typescript
{
  equipmentId: "eq_123",
  equipmentCode: "EQ-001",
  name: "Пресс гидравлический",
  type: "Пресс",
  category: "Общее",
  performedBy: "usr-editor",
  performedByEmail: "editor@ems.local"
}
```

#### `wms.stock.received`
```typescript
{
  itemId: "item_456",
  sku: "ZIP-001",
  name: "Подшипник 6205",
  quantity: 10,
  totalQuantity: 150,
  warehouse: "Основной склад",
  movementId: "mov_789",
  performedBy: "usr-storekeeper"
}
```

#### `eps.approval.resolved`
```typescript
{
  approvalId: "apr_321",
  targetType: "EQUIPMENT_VERSION",
  targetId: "eq_123",
  decision: "APPROVED",  // или "REJECTED"
  comments: "Согласовано",
  decidedBy: "usr-approver"
}
```

---

## 6. Подписки в Shell

### 6.1. Webhook Dispatcher

Автоматически подписывается на все события и отправляет webhook'и:

```typescript
// src/lib/webhooks/webhook-service.ts
eventBus.subscribe("*", (payload: SystemEventPayload) => {
  const activeSubs = subscriptions.filter(
    (s) => s.isActive && (
      s.subscribedEvents.includes("*") || 
      s.subscribedEvents.includes(payload.eventType)
    )
  );
  
  activeSubs.forEach((sub) => {
    dispatchWebhook(sub, payload).catch(() => {});
  });
});
```

### 6.2. SSE Broadcaster

Отправляет события подключённым UI-клиентам:

```typescript
// В ShellEventBus.publish()
this.sseClients.forEach((clientFn) => {
  try {
    clientFn(event);
  } catch (err) {
    console.error("[ShellEventBus] Error pushing to SSE client:", err);
  }
});
```

### 6.3. Audit Logger

Логирует все события через `logEvent()`:

```typescript
// В ShellEventBus.publish()
logEvent({
  level: "info",
  module: sourceModule.toUpperCase(),
  action: `EVENT_PUBLISHED:${eventName}`,
  details: {
    eventId: event.id,
    correlationId: event.correlationId,
    payload
  }
});
```

---

## 7. Обработка ошибок

### 7.1. Изоляция handler'ов

Ошибки в одном handler'е не влияют на другие:

```typescript
const promises = allHandlers.map(async (handler) => {
  try {
    await handler(event);
  } catch (err) {
    console.error(`[ShellEventBus] Error handling event ${eventName}:`, err);
    logEvent({
      level: "error",
      module: "SHELL_EVENT_BUS",
      action: `HANDLER_ERROR:${eventName}`,
      details: { error: String(err), eventId: event.id }
    });
  }
});

await Promise.allSettled(promises);
```

### 7.2. Retry в Outbox

```typescript
catch (err) {
  failed++;
  await prisma.wmsOutboxEvent.update({
    where: { id: event.id },
    data: {
      retryCount: { increment: 1 },
      lastError: String(err),
      status: event.retryCount >= 4 ? "FAILED" : "PENDING"
    }
  });
}
```

---

## 8. Мониторинг

### 8.1. Метрики

- Количество событий в outbox по статусам
- Среднее время обработки
- Количество failed событий
- Количество активных SSE-подключений

### 8.2. Логирование

Все события логируются через `logEvent()` с уровнем `info` или `error`.

### 8.3. API для мониторинга

```typescript
// Получить статистику outbox
const stats = await prisma.wmsOutboxEvent.groupBy({
  by: ["status"],
  _count: { id: true }
});
```

---

## 9. Лучшие практики

✅ **Делать:**
- Использовать Transactional Outbox для критичных событий
- Публиковать события в той же транзакции, что и бизнес-операция
- Следовать соглашению об именовании `{module}.{entity}.{action}`
- Включать `correlationId` для трейсинга
- Логировать все события через `logEvent()`
- Документировать payload событий

❌ **Не делать:**
- Не публиковать чувствительные данные (пароли, токены)
- Не использовать ShellEventBus для гарантированной доставки (только для real-time)
- Не подписываться на `*` без необходимости (нагрузка)
- Не забывать отписываться от событий (утечка памяти)
- Не блокировать основной поток в handler'ах

---

## 10. Пример: полный flow события

```typescript
// 1. API endpoint создаёт оборудование
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "..." }, { status: 401 });
  
  const body = await request.json();
  const validation = createSchema.safeParse(body);
  if (!validation.success) return NextResponse.json({ error: "..." }, { status: 400 });
  
  // 2. Транзакция с outbox
  const equipment = await prisma.$transaction(async (tx) => {
    const eq = await tx.equipment.create({ data: validation.data });
    
    // 3. Запись в outbox
    await recordWmsOutboxEvent(tx, {
      eventName: "eps.equipment.created",
      aggregateType: "Equipment",
      aggregateId: eq.id,
      payload: {
        equipmentId: eq.id,
        equipmentCode: eq.equipmentCode,
        name: eq.name,
        performedBy: session.id
      }
    });
    
    return eq;
  });
  
  // 4. Audit log
  logEvent({
    level: "audit",
    module: "EPS",
    action: "EQUIPMENT_CREATED",
    userId: session.id,
    details: { equipmentId: equipment.id }
  });
  
  return NextResponse.json({ success: true, item: equipment }, { status: 201 });
}

// 5. Outbox processor (запускается по cron)
async function processOutbox() {
  const events = await prisma.wmsOutboxEvent.findMany({
    where: { status: "PENDING", retryCount: { lt: 5 } },
    take: 50
  });
  
  for (const event of events) {
    try {
      // 6. Публикация в ShellEventBus
      await ShellEventBus.publish(
        event.eventName,
        event.aggregateType,
        event.payload,
        event.id
      );
      
      // 7. Публикация в eventBus (для webhook'ов)
      eventBus.publish("eps", event.eventName, event.payload, event.payload.performedBy);
      
      // 8. Отметить как обработанное
      await prisma.wmsOutboxEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() }
      });
    } catch (err) {
      // 9. Retry logic
      await prisma.wmsOutboxEvent.update({
        where: { id: event.id },
        data: {
          retryCount: { increment: 1 },
          lastError: String(err),
          status: event.retryCount >= 4 ? "FAILED" : "PENDING"
        }
      });
    }
  }
}

// 10. Подписчики получают событие
ShellEventBus.subscribe("eps.equipment.created", async (event) => {
  console.log("New equipment:", event.payload);
  // Отправить уведомление, обновить UI, и т.д.
});
```
