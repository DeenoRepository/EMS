# Shell Architecture

> **Версия:** 2.4.0
> **Обновлено:** 2026-08-13 — добавлены секции по Redis, LDAP, HTTPS, OpenTelemetry  
> **Расположение кода:** [`src/lib/shell/`](../../src/lib/shell/), [`src/middleware.ts`](../../src/middleware.ts)

---

## 1. Назначение Shell

Shell — это ядро платформы EMS, которое:

1. **Управляет жизненным циклом модулей** — регистрация, health-check, circuit breaker
2. **Предоставляет кросс-модульные сервисы** — события, хранилище, webhook'и, cron
3. **Обеспечивает безопасность** — middleware, guards, RBAC
4. **Формирует UI-оболочку** — layout, sidebar, topbar, навигация
5. **Маршрутизирует запросы** — Next.js middleware + API routes

---

## 2. Архитектурные слои

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Layout    │  │   Sidebar   │  │   Module Pages      │  │
│  │  (Shell)    │  │  (Dynamic)  │  │  (/modules/[id])    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Middleware Layer (Edge)                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  JWT Verification → RBAC Check → Module Access     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Shell API  │  │  Module API │  │  Admin API          │  │
│  │  /api/shell │  │ /api/modules│  │  /api/admin         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer (lib/)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │   Auth   │ │  Event   │ │ Storage  │ │   Webhooks   │    │
│  │  (RBAC)  │ │   Bus    │ │ (S3/Local│ │  (HMAC)      │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │   Cron   │ │ Circuit  │ │ Outbox   │ │   Logger     │    │
│  │  Engine  │ │ Breaker  │ │Processor │ │  (Audit)     │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  PostgreSQL │  │    MinIO    │  │  In-Memory State    │  │
│  │  (Prisma)   │  │   (S3 API)  │  │  (Token, RateLimit) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Кросс-модульные сервисы Shell

### 3.1. Event Bus ([`src/lib/shell/event-bus.ts`](../../src/lib/shell/event-bus.ts))

**Назначение:** In-process pub/sub для доменных событий платформы.

```typescript
import { ShellEventBus } from "@/lib/shell/event-bus";

// Публикация события
await ShellEventBus.publish(
  "eps.equipment.created",
  "EPS",
  { equipmentId: "eq_123", code: "EQ-001" },
  correlationId
);

// Подписка на событие
const unsubscribe = ShellEventBus.subscribe("eps.equipment.created", async (event) => **Версия:** 2.4.0
> {
  console.log("Equipment created:", event.payload);
});

// Подписка на все события (wildcard)
ShellEventBus.subscribe("*", async (event) => **Версия:** 2.4.0
> {
  // Обработка любого события
});
```

**Особенности:**
- Поддержка wildcard (`*`)
- SSE-клиенты для real-time UI
- Изоляция ошибок в handler'ах (`Promise.allSettled`)
- Автоматическое логирование через `logEvent()`

**Соглашения об именовании событий:**
- Формат: `{module}.{entity}.{action}`
- Примеры: `eps.equipment.created`, `wms.stock.received`, `shell.module.degraded`
- Действия: `created`, `updated`, `deleted`, `status_changed`, `approved`, `rejected`

### 3.2. Circuit Breaker ([`src/lib/shell/circuit-breaker.ts`](../../src/lib/shell/circuit-breaker.ts))

**Назначение:** Мониторинг здоровья модулей и автоматическая деградация при сбоях.

```typescript
import { ModuleCircuitBreaker } from "@/lib/shell/circuit-breaker";

// Регистрация успешного вызова
ModuleCircuitBreaker.recordSuccess("eps");

// Регистрация сбоя
ModuleCircuitBreaker.recordFailure("eps", error.message);

// Проверка доступности модуля
if (ModuleCircuitBreaker.isModuleAvailable("eps")) {
  // Выполнить операцию
}

// Получить информацию о здоровье
const health = ModuleCircuitBreaker.getModuleHealth("eps");
// { moduleId, status: "ONLINE" | "DEGRADED" | "OFFLINE", consecutiveFailures, ... }
```

**Пороги:**
- 3 последовательных сбоя → статус `DEGRADED`
- Используется в health-check эндпоинтах модулей

### 3.3. Cron Engine ([`src/lib/shell/cron-engine.ts`](../../src/lib/shell/cron-engine.ts))

**Назначение:** Планировщик периодических задач.

```typescript
import { ShellCronEngine } from "@/lib/shell/cron-engine";

// Регистрация задачи
ShellCronEngine.registerTask({
  id: "my_task",
  name: "My Periodic Task",
  module: "MYMODULE",
  scheduleIntervalMs: 60 * 60 * 1000, // 1 час
  status: "idle",
  handler: async () => **Версия:** 2.4.0
> {
    // Логика задачи
    return { processed: 42 };
  }
});

// Ручной запуск задачи
const result = await ShellCronEngine.runTask("my_task");

// Получить список всех задач
const tasks = ShellCronEngine.getTasksSummary();
```

**Встроенные задачи:**
- `eps_service_due_check` — контроль просроченного ТО (каждый час)
- `wms_min_stock_alert` — контроль неснижаемых остатков (каждые 30 мин)
- `shell_cleanup_logs` — архивация логов (раз в сутки)

### 3.4. UI Slots ([`src/lib/shell/ui-slots.ts`](../../src/lib/shell/ui-slots.ts))

**Назначение:** Динамическое расширение UI точками входа от модулей.

```typescript
import { registerUiSlot, getSlotComponents } from "@/lib/plugins/ui-slots";

// Регистрация слота
registerUiSlot({
  id: "mymodule_dashboard_widget",
  slotId: "dashboard.widgets",
  moduleId: "mymodule",
  title: "My Widget",
  order: 10,
  requiredRoles: ["ADMIN", "EDITOR"],
  renderKey: "MyWidgetComponent"
});

// Получение слотов для конкретной точки
const slots = getSlotComponents("dashboard.widgets", currentUser);
```

**Стандартные точки входа (slotId):**
- `header.actions` — действия в верхней панели
- `sidebar.extra` — дополнительные пункты в sidebar
- `dashboard.widgets` — виджеты на дашборде
- `entity.actions` — действия над сущностями

### 3.5. MCP Adapter ([`src/lib/shell/mcp-adapter.ts`](../../src/lib/shell/mcp-adapter.ts))

**Назначение:** Заготовка для интеграции с Model Context Protocol (AI-агенты).

**Статус:** Резерв для будущей интеграции. Манифест модуля может объявлять `aiCapabilities.exportableTools` и `aiCapabilities.supportedIntentActions`.

### 3.6. Custom Attributes ([`src/lib/shell/custom-attributes.ts`](../../src/lib/shell/custom-attributes.ts))

**Назначение:** Управление динамическими атрибутами сущностей (по типу оборудования).

### 3.7. API Response ([`src/lib/shell/api-response.ts`](../../src/lib/shell/api-response.ts))

**Назначение:** Единый формат ответов API.

```typescript
import { createSuccessResponse, createErrorResponse } from "@/lib/shell/api-response";

// Успешный ответ
return createSuccessResponse({ items: [], total: 0 }, request, 200);

// Ответ с ошибкой
return createErrorResponse("VALIDATION_ERROR", "Некорректные данные", details, 400, request);
```

**Формат:**
```json
{
  "success": true,
  "data": { ... },
  "correlationId": "req_1234567890_abc",
  "timestamp": "2026-08-12T15:00:00.000Z"
}
```

---

## 4. Middleware ([`src/middleware.ts`](../../src/middleware.ts))

**Назначение:** Edge Runtime проверка JWT и базовый RBAC перед обработкой запроса.

**Логика:**
1. Пропуск публичных путей (`/login`, `/api/auth/login`)
2. Извлечение JWT из cookie `ems_session`
3. Верификация токена через `verifySessionToken()`
4. Проверка роли `ADMIN` для `/admin/*` и `/api/admin/*`
5. Проверка доступа к модулю через `hasModuleAccess()`
6. Специфичные правила для отдельных страниц

**Matcher:** `["/((?!_next/static|_next/image|favicon.ico).*)"]`

---

## 5. Plugin Registry ([`src/lib/plugins/registry.ts`](../../src/lib/plugins/registry.ts))

**Назначение:** Реестр зарегистрированных модулей с метаданными.

```typescript
export interface ModuleManifest {
  code: string;           // "EPS", "MRO", "SRM", "WMS"
  name: string;
  description: string;
  version: string;
  entryPoint: string;     // "/modules/eps"
  iconName: string;
  requiredRoles: string[];
  healthCheckUrl: string;
  status: "active" | "degraded" | "offline";
}
```

**Примечание:** Основной манифест модулей находится в [`src/lib/config/modules.ts`](../../src/lib/config/modules.ts) и содержит расширенную структуру (`ModuleManifest` с `navItems`, `nsiCategories`, `uiSlots`, `aiCapabilities`).

---

## 6. Service Token ([`src/lib/plugins/service-token.ts`](../../src/lib/plugins/service-token.ts))

**Назначение:** Межмодульная аутентификация для вызовов между модулями.

---

## 7. Расширение Shell

### 7.1. Добавление нового кросс-модульного сервиса

1. Создать файл в `src/lib/shell/`
2. Реализовать singleton-класс с методами
3. Добавить типы в `src/types/`
4. Обновить документацию в `/docs/rules/`

### 7.2. Добавление новой UI-точки входа

1. Определить `slotId` в `src/lib/config/modules.ts` (тип `UISlotConfig`)
2. Реализовать рендер слота в соответствующем layout-компоненте
3. Документировать для авторов модулей

### 7.3. Добавление нового типа события

1. Определить формат имени: `{module}.{entity}.{action}`
2. Документировать payload (TypeScript interface)
3. Опубликовать через `ShellEventBus.publish()`
4. При необходимости — добавить в Outbox для гарантированной доставки

---

## 8. Мониторинг и наблюдаемость

### 8.1. Health Checks
Каждый модуль должен предоставлять эндпоинт `/api/modules/{id}/health`, который:
- Возвращает 200 при нормальной работе
- Возвращает 503 при сбое
- Регистрирует результат в `ModuleCircuitBreaker`

### 8.2. Логирование
Все значимые события логируются через [`logEvent()`](../../src/lib/telemetry/logger.ts:56):
- Структурированный JSON в stdout
- Автоматическая запись в `AuditLog`
- Опциональная отправка в Sentry (через `SENTRY_DSN`)

### 8.3. SSE Events
Real-time события доступны через `/api/shell/events/sse` для UI-обновлений.

---

## 9. Ограничения и best practices

✅ **Делать:**
- Использовать `ShellEventBus` для межмодульной коммуникации
- Регистрировать задачи через `ShellCronEngine`
- Логировать через `logEvent()` с правильным `module` и `action`
- Возвращать ответы через `createSuccessResponse`/`createErrorResponse`

❌ **Не делать:**
- Не обращаться к БД напрямую из UI-компонентов (только через API)
- Не хранить состояние в глобальных переменных (использовать сервисы)
- Не обходить middleware (все запросы проходят через RBAC)
- Не публиковать чувствительные данные в событиях

---

## 4. Инфраструктурный слой (v2.4.0)

Начиная с версии 2.4.0 платформа поддерживает работу в multi-instance окружении через Redis.

### 4.1. Redis ([`src/lib/db/redis.ts`](../../src/lib/db/redis.ts))

Используется для:
- **Token Blacklist** — отзыв JWT токенов
- **Rate Limiter** — защита от brute-force
- **Event Bus** — Pub/Sub для межинстансных событий
- **Circuit Breaker** — состояние модулей
- **Cron Engine** — distributed locking
- **Webhook Subscriptions** — реестр подписок
- **API Keys** — хранение ключей

Fallback на in-memory для development/test.

### 4.2. LDAP/AD ([`src/lib/auth/ldap.ts`](../../src/lib/auth/ldap.ts))

Интеграция с корпоративным Active Directory через `ldapjs`:
- Service bind для поиска пользователя
- User bind для проверки пароля
- Group search и маппинг на EMS роли
- Конфигурация через env переменные

### 4.3. HTTPS ([`nginx.conf`](../../nginx.conf))

SSL/TLS termination на nginx:
- TLS 1.2/1.3
- HSTS с preload
- OCSP Stapling
- HTTP → HTTPS редирект
- ACME challenge для Let's Encrypt

### 4.4. Rate Limiting

Многоуровневая защита:
- Login: 5 req/min
- Upload: 10 req/min
- Admin: 10 req/s
- API: 30 req/s

### 4.5. Monitoring

- **Prometheus** — метрики через `/api/metrics`
- **OpenTelemetry** — distributed tracing
- **Alerting rules** — 25 правил в [`docker/prometheus/alerts.yml`](../../docker/prometheus/alerts.yml)
