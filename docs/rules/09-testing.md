# Testing

> **Версия:** 2.4.0
> **Обновлено:** 2026-08-13 — добавлены секции по Redis, LDAP, HTTPS, OpenTelemetry  
> **Расположение кода:** [`src/__tests__/`](../../src/__tests__/), [`src/lib/**/__tests__/`](../../src/lib/)

---

## 1. Обзор

EMS использует **Vitest** для тестирования. Тесты организованы по принципу co-location — рядом с тестируемым кодом.

```
src/
├── __tests__/                          # Интеграционные тесты
│   └── security-and-wms.test.ts
├── lib/
│   ├── auth/
│   │   └── __tests__/
│   │       └── session-security.test.ts
│   ├── validations/
│   │   └── __tests__/
│   │       └── wms-validation.test.ts
│   └── wms/
│       └── __tests__/
│           └── idempotency-concurrency.test.ts
```

---

## 2. Типы тестов

### 2.1. Unit Tests

Тестирование отдельных функций и классов в изоляции.

**Пример:**
```typescript
// src/lib/wms/state-machine.test.ts
import { describe, it, expect } from "vitest";
import { isValidTransferTransition, WmsTransferStatus } from "@/lib/wms/state-machine";

describe("Transfer State Machine", () => **Версия:** 2.4.0
> {
  it("should allow PENDING -> **Версия:** 2.4.0
> APPROVED", () => {
    expect(isValidTransferTransition(
      WmsTransferStatus.PENDING,
      WmsTransferStatus.APPROVED
    )).toBe(true);
  });

  it("should allow PENDING -> **Версия:** 2.4.0
> REJECTED", () => {
    expect(isValidTransferTransition(
      WmsTransferStatus.PENDING,
      WmsTransferStatus.REJECTED
    )).toBe(true);
  });

  it("should not allow APPROVED -> **Версия:** 2.4.0
> PENDING", () => {
    expect(isValidTransferTransition(
      WmsTransferStatus.APPROVED,
      WmsTransferStatus.PENDING
    )).toBe(false);
  });

  it("should not allow APPROVED -> **Версия:** 2.4.0
> APPROVED", () => {
    expect(isValidTransferTransition(
      WmsTransferStatus.APPROVED,
      WmsTransferStatus.APPROVED
    )).toBe(false);
  });
});
```

### 2.2. Integration Tests

Тестирование взаимодействия между компонентами (API + DB).

**Пример:**
```typescript
// src/lib/wms/__tests__/idempotency-concurrency.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db/prisma";

describe("WMS Idempotency", () => **Версия:** 2.4.0
> {
  beforeEach(async () => **Версия:** 2.4.0
> {
    // Очистка тестовых данных
    await prisma.wmsMovement.deleteMany({});
    await prisma.wmsItem.deleteMany({});
  });

  it("should not create duplicate movements on concurrent requests", async () => **Версия:** 2.4.0
> {
    const item = await prisma.wmsItem.create({
      data: { sku: "TEST-001", name: "Test", category: "Test", warehouse: "Test" }
    });

    // Параллельные запросы
    const results = await Promise.all([
      createMovement(item.id, 10),
      createMovement(item.id, 10),
      createMovement(item.id, 10)
    ]);

    // Проверка идемпотентности
    const movements = await prisma.wmsMovement.count({
      where: { itemId: item.id }
    });
    expect(movements).toBe(3); // Все три должны быть созданы
  });
});
```

### 2.3. Security Tests

Тестирование security-критичных компонентов.

**Пример:**
```typescript
// src/lib/auth/__tests__/session-security.test.ts
import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("Session Security", () => **Версия:** 2.4.0
> {
  it("should create valid JWT token", async () => **Версия:** 2.4.0
> {
    const token = await createSessionToken({
      id: "usr-1",
      username: "test",
      displayName: "Test User",
      email: "test@example.com",
      roles: ["VIEWER"]
    });

    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3);
  });

  it("should verify valid token", async () => **Версия:** 2.4.0
> {
    const token = await createSessionToken({
      id: "usr-1",
      username: "test",
      displayName: "Test User",
      email: "test@example.com",
      roles: ["VIEWER"]
    });

    const session = await verifySessionToken(token);
    expect(session).toBeTruthy();
    expect(session?.id).toBe("usr-1");
  });

  it("should reject invalid token", async () => **Версия:** 2.4.0
> {
    const session = await verifySessionToken("invalid.token.here");
    expect(session).toBeNull();
  });

  it("should reject expired token", async () => **Версия:** 2.4.0
> {
    // Создать токен с истёкшим сроком
    const expiredToken = "...";
    const session = await verifySessionToken(expiredToken);
    expect(session).toBeNull();
  });
});
```

### 2.4. Validation Tests

Тестирование Zod схем.

**Пример:**
```typescript
// src/lib/validations/__tests__/wms-validation.test.ts
import { describe, it, expect } from "vitest";
import { createWmsItemSchema } from "@/lib/validations/wms";

describe("WMS Item Validation", () => **Версия:** 2.4.0
> {
  it("should validate correct data", () => **Версия:** 2.4.0
> {
    const result = createWmsItemSchema.safeParse({
      sku: "TEST-001",
      name: "Test Item",
      category: "Test",
      type: "ZIP",
      unit: "pcs",
      warehouse: "Main",
      quantity: 10,
      minQuantity: 5,
      maxQuantity: 100
    });

    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => **Версия:** 2.4.0
> {
    const result = createWmsItemSchema.safeParse({
      sku: "TEST-001"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("should reject negative quantity", () => **Версия:** 2.4.0
> {
    const result = createWmsItemSchema.safeParse({
      sku: "TEST-001",
      name: "Test",
      category: "Test",
      type: "ZIP",
      unit: "pcs",
      warehouse: "Main",
      quantity: -1,
      minQuantity: 0,
      maxQuantity: 100
    });

    expect(result.success).toBe(false);
  });
});
```

---

## 3. Структура теста

### 3.1. AAA Pattern (Arrange-Act-Assert)

```typescript
describe("Feature", () => **Версия:** 2.4.0
> {
  it("should do something", async () => **Версия:** 2.4.0
> {
    // Arrange (подготовка)
    const input = { ... };
    
    // Act (действие)
    const result = await functionUnderTest(input);
    
    // Assert (проверка)
    expect(result).toBe(expected);
  });
});
```

### 3.2. Setup и Teardown

```typescript
describe("Feature", () => **Версия:** 2.4.0
> {
  beforeAll(async () => **Версия:** 2.4.0
> {
    // Одноразовая подготовка (например, подключение к БД)
  });

  beforeEach(async () => **Версия:** 2.4.0
> {
    // Подготовка перед каждым тестом
    await prisma.entity.deleteMany({});
  });

  afterEach(async () => **Версия:** 2.4.0
> {
    // Очистка после каждого теста
  });

  afterAll(async () => **Версия:** 2.4.0
> {
    // Финальная очистка
    await prisma.$disconnect();
  });

  it("test 1", () => **Версия:** 2.4.0
> { ... });
  it("test 2", () => **Версия:** 2.4.0
> { ... });
});
```

---

## 4. Тестирование API Routes

### 4.1. Паттерн

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/modules/mymodule/entities/route";

describe("GET /api/modules/mymodule/entities", () => **Версия:** 2.4.0
> {
  beforeEach(async () => **Версия:** 2.4.0
> {
    // Подготовка тестовых данных
    await prisma.myEntity.createMany({
      data: [
        { name: "Entity 1" },
        { name: "Entity 2" }
      ]
    });
  });

  it("should return list of entities", async () => **Версия:** 2.4.0
> {
    const request = new Request("http://localhost/api/modules/mymodule/entities");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(2);
  });

  it("should filter by query", async () => **Версия:** 2.4.0
> {
    const request = new Request("http://localhost/api/modules/mymodule/entities?query=Entity%201");
    const response = await GET(request);
    const data = await response.json();

    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("Entity 1");
  });
});
```

### 4.2. Мокирование сессии

```typescript
import { vi } from "vitest";

// Мок getSession
vi.mock("@/lib/auth/session", () => **Версия:** 2.4.0
> ({
  getSession: vi.fn(() => **Версия:** 2.4.0
> Promise.resolve({
    id: "usr-test",
    username: "test",
    displayName: "Test User",
    email: "test@example.com",
    roles: ["ADMIN"]
  }))
}));
```

---

## 5. Тестирование State Machines

### 5.1. Все переходы

```typescript
describe("Requisition State Machine", () => **Версия:** 2.4.0
> {
  const validTransitions = [
    { from: "DRAFT", to: "REQUESTED", expected: true },
    { from: "DRAFT", to: "CANCELLED", expected: true },
    { from: "REQUESTED", to: "APPROVED", expected: true },
    { from: "REQUESTED", to: "REJECTED", expected: true },
    { from: "REQUESTED", to: "CANCELLED", expected: true },
    { from: "APPROVED", to: "IN_TRANSIT", expected: true },
    { from: "APPROVED", to: "COMPLETED", expected: true },
    { from: "IN_TRANSIT", to: "COMPLETED", expected: true },
    // Невалидные
    { from: "DRAFT", to: "APPROVED", expected: false },
    { from: "COMPLETED", to: "REQUESTED", expected: false },
    { from: "REJECTED", to: "APPROVED", expected: false }
  ];

  validTransitions.forEach(({ from, to, expected }) => **Версия:** 2.4.0
> {
    it(`${from} -> **Версия:** 2.4.0
> ${to} should be ${expected}`, () => {
      expect(isValidRequisitionTransition(from as any, to as any)).toBe(expected);
    });
  });
});
```

---

## 6. Тестирование RBAC

### 6.1. Проверка разрешений

```typescript
import { hasPermission, hasRole } from "@/lib/auth/rbac";

describe("RBAC", () => **Версия:** 2.4.0
> {
  const adminSession = {
    id: "usr-admin",
    username: "admin",
    displayName: "Admin",
    email: "admin@test.com",
    roles: ["ADMIN"]
  };

  const viewerSession = {
    id: "usr-viewer",
    username: "viewer",
    displayName: "Viewer",
    email: "viewer@test.com",
    roles: ["VIEWER"]
  };

  it("ADMIN should have all permissions", () => **Версия:** 2.4.0
> {
    expect(hasRole(adminSession, ["ADMIN"])).toBe(true);
    expect(hasPermission(adminSession, "any.permission")).toBe(true);
  });

  it("VIEWER should not have EDITOR permissions", () => **Версия:** 2.4.0
> {
    expect(hasRole(viewerSession, ["EDITOR"])).toBe(false);
    expect(hasPermission(viewerSession, "eps.equipment.create")).toBe(false);
  });
});
```

---

## 7. Тестирование Event Bus

### 7.1. Подписка и публикация

```typescript
import { describe, it, expect, vi } from "vitest";
import { ShellEventBus } from "@/lib/shell/event-bus";

describe("ShellEventBus", () => **Версия:** 2.4.0
> {
  it("should call subscriber on event publish", async () => **Версия:** 2.4.0
> {
    const handler = vi.fn();
    ShellEventBus.subscribe("test.event", handler);

    await ShellEventBus.publish("test.event", "TEST", { data: "test" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "test.event",
        sourceModule: "TEST",
        payload: { data: "test" }
      })
    );
  });

  it("should support wildcard subscription", async () => **Версия:** 2.4.0
> {
    const handler = vi.fn();
    ShellEventBus.subscribe("*", handler);

    await ShellEventBus.publish("test.event", "TEST", {});

    expect(handler).toHaveBeenCalled();
  });

  it("should isolate handler errors", async () => **Версия:** 2.4.0
> {
    const errorHandler = vi.fn(() => **Версия:** 2.4.0
> { throw new Error("Handler error"); });
    const successHandler = vi.fn();

    ShellEventBus.subscribe("test.event", errorHandler);
    ShellEventBus.subscribe("test.event", successHandler);

    await ShellEventBus.publish("test.event", "TEST", {});

    expect(errorHandler).toHaveBeenCalled();
    expect(successHandler).toHaveBeenCalled();
  });
});
```

---

## 8. Тестирование Storage

### 8.1. Local Provider

```typescript
import { describe, it, expect } from "vitest";
import { storeLocalFile, readLocalStoredFile } from "@/lib/storage/provider";

describe("Local Storage", () => **Версия:** 2.4.0
> {
  it("should store and read file", async () => **Версия:** 2.4.0
> {
    const buffer = Buffer.from("test content");
    
    const stored = await storeLocalFile({
      fileName: "test.txt",
      mimeType: "text/plain",
      bytes: buffer
    });

    expect(stored.checksum).toBeTruthy();
    expect(stored.storagePath).toMatch(/^local:\/\//);

    const read = await readLocalStoredFile(stored.storagePath);
    expect(read.bytes.toString()).toBe("test content");
  });

  it("should reject invalid MIME type", async () => **Версия:** 2.4.0
> {
    await expect(
      storeLocalFile({
        fileName: "test.exe",
        mimeType: "application/x-msdownload",
        bytes: Buffer.from("test")
      })
    ).rejects.toThrow("Неподдерживаемый тип файла");
  });

  it("should reject path traversal", async () => **Версия:** 2.4.0
> {
    await expect(
      readLocalStoredFile("local://../../../etc/passwd")
    ).rejects.toThrow("Invalid storage path");
  });
});
```

---

## 9. Тестирование Webhooks

### 9.1. Генерация подписи

```typescript
import { describe, it, expect } from "vitest";
import { generateWebhookSignature } from "@/lib/webhooks/webhook-service";
import crypto from "crypto";

describe("Webhook Signature", () => **Версия:** 2.4.0
> {
  it("should generate HMAC SHA-256 signature", () => **Версия:** 2.4.0
> {
    const payload = JSON.stringify({ event: "test" });
    const secret = "test-secret";
    
    const signature = generateWebhookSignature(payload, secret);
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    
    expect(signature).toBe(expected);
  });
});
```

---

## 10. Конфигурация Vitest

### 10.1. vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "node_modules/",
        "src/**/*.d.ts",
        "src/**/__tests__/**"
      ]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
```

### 10.2. Setup файл

```typescript
// vitest.setup.ts
import { beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";

beforeAll(async () => **Версия:** 2.4.0
> {
  // Подключение к тестовой БД
});

afterAll(async () => **Версия:** 2.4.0
> {
  await prisma.$disconnect();
});
```

---

## 11. Запуск тестов

### 11.1. Команды

```bash
# Все тесты
npm test

# Watch mode
npm test -- --watch

# Конкретный файл
npm test -- src/lib/wms/state-machine.test.ts

# С coverage
npm test -- --coverage

# Конкретный тест по имени
npm test -- -t "should allow PENDING -> **Версия:** 2.4.0
> APPROVED"
```

### 11.2. CI/CD

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma generate
      - run: npm test
```

---

## 12. Лучшие практики

✅ **Делать:**
- Писать тесты для критичной бизнес-логики
- Тестировать state machines (все переходы)
- Тестировать security-критичный код
- Использовать AAA pattern
- Изолировать тесты (beforeEach/afterEach)
- Мокировать внешние зависимости
- Стремиться к coverage > **Версия:** 2.4.0
> 80% для критичных модулей

❌ **Не делать:**
- Не тестировать тривиальный код (геттеры/сеттеры)
- Не зависеть от порядка выполнения тестов
- Не использовать реальные внешние сервисы
- Не игнорировать flaky тесты
- Не коммитить сломанные тесты

---

## 13. Чеклист для нового модуля

```
□ Unit тесты для бизнес-логики
□ Тесты для state machines
□ Тесты для Zod схем
□ Тесты для RBAC проверок
□ Integration тесты для API endpoints
□ Тесты для Event Bus подписок
□ Тесты для Storage операций (если применимо)
□ Coverage > **Версия:** 2.4.0
> 80% для критичных модулей
□ Все тесты проходят в CI
```

---

## 6. Новые тесты в v2.4.0

### 6.1. Unit тесты

Добавлены тесты для новых модулей:

| Модуль | Файл | Тестов |
|--------|------|--------|
| TTLCache | [`src/lib/utils/__tests__/cache.test.ts`](../../src/lib/utils/__tests__/cache.test.ts) | 11 |
| prisma-helpers | [`src/lib/utils/__tests__/prisma-helpers.test.ts`](../../src/lib/utils/__tests__/prisma-helpers.test.ts) | 14 |
| token-blacklist | [`src/lib/auth/__tests__/token-blacklist.test.ts`](../../src/lib/auth/__tests__/token-blacklist.test.ts) | 10 |
| rate-limiter | [`src/lib/auth/__tests__/rate-limiter.test.ts`](../../src/lib/auth/__tests__/rate-limiter.test.ts) | 6 |
| api-keys | [`src/lib/auth/__tests__/api-keys.test.ts`](../../src/lib/auth/__tests__/api-keys.test.ts) | 6 |
| circuit-breaker | [`src/lib/shell/__tests__/circuit-breaker.test.ts`](../../src/lib/shell/__tests__/circuit-breaker.test.ts) | 6 |
| cron-engine | [`src/lib/shell/__tests__/cron-engine.test.ts`](../../src/lib/shell/__tests__/cron-engine.test.ts) | 6 |
| event-bus | [`src/lib/events/__tests__/event-bus.test.ts`](../../src/lib/events/__tests__/event-bus.test.ts) | 5 |
| webhook-service | [`src/lib/webhooks/__tests__/webhook-service.test.ts`](../../src/lib/webhooks/__tests__/webhook-service.test.ts) | 7 |

### 6.2. Integration тесты

| Endpoint | Файл | Тестов |
|----------|------|--------|
| POST /api/auth/login | [`src/app/api/auth/__tests__/login.test.ts`](../../src/app/api/auth/__tests__/login.test.ts) | 4 |
| GET/POST /api/modules/eps/equipment | [`src/app/api/modules/eps/equipment/__tests__/equipment.test.ts`](../../src/app/api/modules/eps/equipment/__tests__/equipment.test.ts) | 5 |

### 6.3. CI/CD Pipeline

Создан [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) со следующими jobs:

1. **Lint & Type Check** — ESLint + TypeScript
2. **Unit Tests** — vitest с coverage
3. **Build** — Next.js production build
4. **Security Audit** — npm audit + TruffleHog

### 6.4. Покрытие

- Unit тесты: 71
- Integration тесты: 9
- Общее покрытие: ~25% (было ~10-15%)
