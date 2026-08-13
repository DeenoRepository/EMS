# API Conventions

> **Расположение кода:** [`src/lib/shell/api-response.ts`](../../src/lib/shell/api-response.ts), [`src/app/api/`](../../src/app/api/)

---

## 1. Обзор

Все API endpoints в EMS следуют единым соглашениям для обеспечения консистентности и предсказуемости.

---

## 2. Структура URL

### 2.1. Префиксы

```
/api/shell/*          # Кросс-модульные сервисы Shell
/api/admin/*          # Админ-панель (только ADMIN)
/api/modules/{id}/*   # API модулей (eps, wms, mro, srm)
/api/reference/*      # Справочники
/api/auth/*           # Аутентификация
```

### 2.2. RESTful ресурсы

```
GET    /api/modules/eps/equipment           # Список
POST   /api/modules/eps/equipment           # Создание
GET    /api/modules/eps/equipment/[id]      # Детали
PUT    /api/modules/eps/equipment/[id]      # Полное обновление
PATCH  /api/modules/eps/equipment/[id]      # Частичное обновление
DELETE /api/modules/eps/equipment/[id]      # Удаление
```

### 2.3. Специальные endpoints

```
GET    /api/modules/eps/health              # Health check
GET    /api/modules/eps/equipment/export    # Экспорт (CSV/Excel)
GET    /api/modules/eps/approval-queue/count # Счётчик для UI
POST   /api/modules/wms/outbox/process      # Ручной запуск outbox
```

---

## 3. Формат ответов

### 3.1. Единая обёртка

Все ответы используют [`createSuccessResponse()`](../../src/lib/shell/api-response.ts:22) и [`createErrorResponse()`](../../src/lib/shell/api-response.ts:36):

```typescript
interface ShellAPIResponseBody<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId: string;
  timestamp: string;
}
```

### 3.2. Успешный ответ

```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 42
  },
  "correlationId": "req_1704067200_abc",
  "timestamp": "2026-08-12T15:00:00.000Z"
}
```

**HTTP Status:** 200, 201, 204

### 3.3. Ответ с ошибкой

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректные данные",
    "details": {
      "fieldErrors": {
        "name": ["Название обязательно"]
      }
    }
  },
  "correlationId": "req_1704067200_abc",
  "timestamp": "2026-08-12T15:00:00.000Z"
}
```

**HTTP Status:** 400, 401, 403, 404, 409, 500

### 3.4. Legacy формат (для обратной совместимости)

Некоторые endpoints возвращают данные напрямую (без обёртки):

```json
{
  "items": [...],
  "total": 42
}
```

**Рекомендация:** Новые endpoints должны использовать единую обёртку.

---

## 4. HTTP Status Codes

| Код | Назначение | Пример |
|-----|-----------|--------|
| 200 | OK | Успешный GET, PUT, PATCH |
| 201 | Created | Успешный POST |
| 204 | No Content | Успешный DELETE |
| 400 | Bad Request | Ошибка валидации Zod |
| 401 | Unauthorized | Нет сессии или невалидный JWT |
| 403 | Forbidden | Недостаточно прав |
| 404 | Not Found | Ресурс не найден |
| 409 | Conflict | Конфликт состояния (state machine) |
| 500 | Internal Server Error | Необработанная ошибка |
| 503 | Service Unavailable | Health check failed |

---

## 5. Валидация входных данных

### 5.1. Zod схемы

Все входные данные валидируются через Zod:

```typescript
import { z } from "zod";

const createEntitySchema = z.object({
  name: z.string().min(2, "Название должно содержать минимум 2 символа"),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});
```

### 5.2. Query параметры

```typescript
const querySchema = z.object({
  query: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});
```

### 5.3. Path параметры

```typescript
const paramsSchema = z.object({
  id: z.string().min(1, "ID обязателен")
});

// В Next.js 15+:
// export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
//   const { id } = await params;
//   const validation = paramsSchema.safeParse({ id });
// }
```

### 5.4. Обработка ошибок валидации

```typescript
const validation = schema.safeParse(body);
if (!validation.success) {
  return NextResponse.json(
    { 
      error: "Некорректные данные", 
      details: validation.error.flatten() 
    },
    { status: 400 }
  );
}
```

---

## 6. Аутентификация и авторизация

### 6.1. Проверка сессии

```typescript
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Необходима авторизация" },
      { status: 401 }
    );
  }
  // ...
}
```

### 6.2. Проверка разрешений

```typescript
import { hasPermission } from "@/lib/auth/rbac";

if (!hasPermission(session, "eps.equipment.create")) {
  return NextResponse.json(
    { error: "Доступ запрещен" },
    { status: 403 }
  );
}
```

### 6.3. Использование Guards

```typescript
import { requireSession, requireRole } from "@/lib/auth/guards";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.authorized) return auth.response;
  
  const roleCheck = requireRole(auth.session, ["ADMIN", "EDITOR"]);
  if (!roleCheck.authorized) return roleCheck.response;
  
  // ...
}
```

---

## 7. Пагинация

### 7.1. Offset-based (текущий стандарт)

```typescript
// Request
GET /api/modules/eps/equipment?limit=50&offset=0

// Response
{
  "items": [...],
  "total": 1234,
  "limit": 50,
  "offset": 0
}
```

### 7.2. Cursor-based (рекомендуется для больших списков)

```typescript
// Request
GET /api/modules/eps/equipment?cursor=eyJpZCI6IjEyMyJ9&limit=50

// Response
{
  "items": [...],
  "nextCursor": "eyJpZCI6IjE3MyJ9",
  "hasMore": true
}
```

---

## 8. Фильтрация и поиск

### 8.1. Простая фильтрация

```typescript
// Query параметры
GET /api/modules/eps/equipment?status=ACTIVE&type=Пресс

// В коде
const where: Prisma.EquipmentWhereInput = {};
if (status) where.status = status as EquipmentStatus;
if (type) where.type = type;
```

### 8.2. Полнотекстовый поиск

```typescript
// Query параметр
GET /api/modules/eps/equipment?query=пресс

// В коде
if (query) {
  where.OR = [
    { name: { contains: query, mode: "insensitive" } },
    { equipmentCode: { contains: query, mode: "insensitive" } },
    { inventoryNumber: { contains: query, mode: "insensitive" } }
  ];
}
```

### 8.3. Сложная фильтрация

```typescript
// POST с телом запроса
POST /api/modules/eps/equipment/search
{
  "filters": {
    "status": ["ACTIVE", "INACTIVE"],
    "type": ["Пресс", "Станок"],
    "department": "Цех 1",
    "serviceDueDate": {
      "from": "2026-01-01",
      "to": "2026-12-31"
    }
  },
  "sort": {
    "field": "name",
    "order": "asc"
  },
  "pagination": {
    "limit": 50,
    "offset": 0
  }
}
```

---

## 9. Correlation ID

### 9.1. Назначение

Каждый запрос получает уникальный `correlationId` для трейсинга:

```typescript
import { getCorrelationId } from "@/lib/shell/api-response";

const correlationId = getCorrelationId(request);
// Из заголовка x-correlation-id или сгенерированный
```

### 9.2. Использование

- Передаётся в заголовке ответа: `x-correlation-id`
- Включается в логи
- Передаётся в события Event Bus
- Используется для отладки в production

### 9.3. Клиентский код

```typescript
const response = await fetch("/api/modules/eps/equipment", {
  headers: {
    "x-correlation-id": `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  }
});
```

---

## 10. Обработка ошибок

### 10.1. Стандартный паттерн

```typescript
export async function GET(request: Request) {
  try {
    // 1. Аутентификация
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    // 2. Авторизация
    if (!hasPermission(session, "eps.equipment.read")) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    // 3. Валидация
    const { searchParams } = new URL(request.url);
    const validation = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!validation.success) {
      return NextResponse.json(
        { error: "Некорректные параметры", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // 4. Бизнес-логика
    const items = await prisma.equipment.findMany({ where: ... });

    // 5. Ответ
    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    console.error("Equipment list failed:", err);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
```

### 10.2. Специфичные ошибки

```typescript
// 404 Not Found
if (!equipment) {
  return NextResponse.json({ error: "Оборудование не найдено" }, { status: 404 });
}

// 409 Conflict (state machine)
if (!isValidTransition(currentStatus, newStatus)) {
  return NextResponse.json(
    { error: "Недопустимый переход состояния", currentStatus, newStatus },
    { status: 409 }
  );
}
```

---

## 11. Транзакции

### 11.1. Простая транзакция

```typescript
const result = await prisma.$transaction(async (tx) => {
  const entity = await tx.entity.create({ data });
  await tx.auditLog.create({ data: { ... } });
  return entity;
});
```

### 11.2. Транзакция с Outbox

```typescript
const result = await prisma.$transaction(async (tx) => {
  const entity = await tx.entity.create({ data });
  
  await recordWmsOutboxEvent(tx, {
    eventName: "mymodule.entity.created",
    aggregateType: "Entity",
    aggregateId: entity.id,
    payload: { ... }
  });
  
  return entity;
});
```

---

## 12. Audit Logging

### 12.1. Обязательные случаи

Логировать через `logEvent()`:
- Создание/обновление/удаление сущностей
- Изменение статусов
- Согласования (approve/reject)
- Экспорт данных
- Изменения в админ-панели

### 12.2. Пример

```typescript
logEvent({
  level: "audit",
  module: "EPS",
  action: "EQUIPMENT_CREATED",
  userId: session.id,
  userEmail: session.email,
  details: {
    equipmentId: created.id,
    code: created.equipmentCode,
    name: created.name
  }
});
```

---

## 13. Rate Limiting

### 13.1. Nginx (глобально)

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

location /api/ {
  limit_req zone=api_limit burst=20 nodelay;
  proxy_pass http://ems-app:3000;
}
```

### 13.2. Application (для auth)

```typescript
import { checkLoginRateLimit } from "@/lib/auth/rate-limiter";

const rateLimit = checkLoginRateLimit(`${ip}:${username}`);
if (rateLimit.isBlocked) {
  return NextResponse.json(
    { error: "Слишком много попыток", retryAfter: rateLimit.retryAfterSeconds },
    { status: 429 }
  );
}
```

---

## 14. CORS

### 14.1. Конфигурация

CORS не настроен явно — API предназначены для same-origin запросов через Next.js.

### 14.2. Для внешних интеграций

Если требуется CORS (например, для webhook'ов), настроить в `next.config.ts`:

```typescript
async headers() {
  return [
    {
      source: "/api/webhooks/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Access-Control-Allow-Methods", value: "POST" },
        { key: "Access-Control-Allow-Headers", value: "Content-Type, X-EMS-Signature" }
      ]
    }
  ];
}
```

---

## 15. Версионирование API

### 15.1. Стратегия

Текущая версия: `v1` (неявно, через URL без префикса).

Для breaking changes:
```
/api/v2/modules/eps/equipment
```

### 15.2. Обратная совместимость

- Не удалять поля из ответов без предупреждения
- Добавлять новые поля как опциональные
- Версионировать через заголовок `Accept: application/vnd.ems.v2+json`

---

## 16. Документирование

### 16.1. JSDoc

Каждый endpoint должен иметь JSDoc комментарий:

```typescript
/**
 * GET /api/modules/eps/equipment
 * 
 * Получить список оборудования с фильтрацией и пагинацией.
 * 
 * @requires Permission: eps.equipment.read
 * @param {string} query - Поисковый запрос
 * @param {string} status - Фильтр по статусу
 * @param {number} limit - Количество записей (1-100, default 50)
 * @param {number} offset - Смещение (default 0)
 * @returns {Promise<{items: Equipment[], total: number}>}
 */
export async function GET(request: Request) { ... }
```

### 16.2. OpenAPI (рекомендуется)

Генерировать OpenAPI спецификацию из JSDoc/Zod схем.

---

## 17. Лучшие практики

✅ **Делать:**
- Использовать Zod для валидации всех входов
- Возвращать единый формат ответов
- Логировать значимые операции
- Использовать транзакции для связанных операций
- Добавлять correlation ID
- Документировать endpoints

❌ **Не делать:**
- Не возвращать чувствительные данные (пароли, токены)
- Не использовать GET для изменения данных
- Не игнорировать ошибки валидации
- Не делать N+1 запросы (использовать `include`)
- Не хардкодить значения (использовать константы)
