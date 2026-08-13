# 🔍 Технический аудит проекта EMS v2.3.7

> **Дата:** 2026-08-13  
> **Аудитор:** Senior Tech Lead  
> **Объект:** Корпоративная модульная платформа EMS (Shell + EPS + WMS)  
> **Стек:** Next.js 16.2.12, React 19.2.4, TypeScript 5.9.3, Prisma 5.17.0, PostgreSQL 16, MinIO

---

## 📊 Сводная оценка

| Категория | Статус | Критичность |
|-----------|--------|-------------|
| Безопасность аутентификации | 🔴 Критично | Блокер релиза |
| Хранение состояния (in-memory) | 🔴 Критично | Блокер релиза |
| Авторизация и RBAC | 🟡 Требует доработки | Высокий приоритет |
| Защита данных и файлов | 🔴 Критично | Блокер релиза |
| Инфраструктура и DevOps | 🟡 Требует доработки | Высокий приоритет |
| Качество кода | 🟡 Требует доработки | Средний приоритет |
| Тестирование | 🔴 Критично | Блокер релиза |
| Производительность | 🟡 Требует доработки | Средний приоритет |
| Документация | 🟢 Приемлемо | Низкий приоритет |

**Общая готовность к production:** ~60% — требуется устранение критических уязвимостей перед выпуском.

---

## 🚨 P0 — КРИТИЧЕСКИЕ УЯЗВИМОСТИ (блокеры релиза)

### SEC-01: Хардкоженные секреты в коде

**Файлы:**
- [`src/lib/auth/session.ts:10`](src/lib/auth/session.ts:10) — fallback JWT secret
- [`src/lib/plugins/service-token.ts:7`](src/lib/plugins/service-token.ts:7) — SERVICE_JWT_SECRET
- [`src/lib/auth/rbac.ts:21-78`](src/lib/auth/rbac.ts:21) — MOCK_USERS с паролями
- [`prisma/seed.ts:178-182`](prisma/seed.ts:178) — bcrypt хеши паролей

**Проблема:**
```typescript
// session.ts:10 — fallback в dev, но если JWT_SECRET не задан в prod, используется предсказуемый ключ
const secretKey = process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== "production" 
    ? "ems-dev-jwt-secret-key-for-local-development-only-32bytes" 
    : "");
```

```typescript
// service-token.ts:7 — даже в production если SERVICE_JWT_SECRET не задан
const serviceSecretKey = process.env.SERVICE_JWT_SECRET || "ems-inter-module-service-token-secret-2026";
```

```typescript
// rbac.ts:21-78 — MOCK_USERS с захардкоженными паролями
admin: { ..., _devPassword: "admin123" },
storekeeper: { ..., _devPassword: "storekeeper123" },
editor: { ..., _devPassword: "editor123" },
approver: { ..., _devPassword: "approver123" },
viewer: { ..., _devPassword: "viewer123" }
```

**Риск:** Компрометация всех сессий, межмодульных вызовов, возможность входа с известными паролями.

**Решение:**
1. Удалить все fallback-секреты из кода
2. Добавить валидацию env переменных при старте (fail-fast)
3. Удалить MOCK_USERS из production-сборки (tree-shaking через `process.env.NODE_ENV`)
4. Сгенерировать новые bcrypt хеши для seed-пользователей
5. Добавить `.env.example` с явными placeholder'ами

---

### SEC-02: MOCK_USERS как бэкдор в production

**Файл:** [`src/app/api/auth/login/route.ts:262-298`](src/app/api/auth/login/route.ts:262)

**Проблема:**
```typescript
// Условие проверки prod неполное — есть путь к MOCK_USERS
if (process.env.NODE_ENV === "production" || process.env.ENABLE_MOCK_AUTH === "false") {
  // ...возврат ошибки
}
// Иначе — fallback на MOCK_USERS
const userEntry = MOCK_USERS[cleanUsername];
```

**Риск:** Если `ENABLE_MOCK_AUTH` не выставлен в `"false"` в production, атакующий может войти под `admin/admin123`.

**Решение:**
```typescript
// Жёсткая проверка: MOCK_USERS только в dev/test
if (process.env.NODE_ENV === "production") {
  return createErrorResponse("INVALID_CREDENTIALS", "Неверный логин или пароль", undefined, 401, request);
}
```

---

### SEC-03: In-memory хранилища не работают в multi-instance

**Файлы:**
- [`src/lib/auth/token-blacklist.ts:7`](src/lib/auth/token-blacklist.ts:7) — `Map<string, number>`
- [`src/lib/auth/rate-limiter.ts:6`](src/lib/auth/rate-limiter.ts:6) — `Map<string, RateLimitRecord>`
- [`src/lib/auth/api-keys.ts:15`](src/lib/auth/api-keys.ts:15) — `const activeApiKeys: ApiKeyConfig[] = []`
- [`src/lib/webhooks/webhook-service.ts:16`](src/lib/webhooks/webhook-service.ts:16) — `const subscriptions: WebhookSubscription[] = []`
- [`src/lib/shell/event-bus.ts`](src/lib/shell/event-bus.ts) — in-process pub/sub
- [`src/lib/shell/cron-engine.ts`](src/lib/shell/cron-engine.ts) — таймеры не запускаются
- [`src/lib/shell/circuit-breaker.ts`](src/lib/shell/circuit-breaker.ts) — состояние теряется

**Проблема:** В production с несколькими инстансами (или serverless):
- Logout не отзовёт токен на других инстансах
- Rate limit не защитит от brute-force
- API keys теряются при рестарте
- Webhook subscriptions теряются при рестарте
- Cron задачи не запускаются автоматически

**Решение:**
1. **Token Blacklist** → Redis с TTL
2. **Rate Limiter** → Redis (sliding window) или Nginx limit_req
3. **API Keys** → таблица `ApiKey` в Prisma
4. **Webhooks** → таблица `WebhookSubscription` в Prisma
5. **Event Bus** → Redis Pub/Sub или NATS
6. **Cron** → отдельный worker-процесс или Kubernetes CronJob
7. **Circuit Breaker** → Redis с TTL

---

### SEC-04: SSE endpoint без авторизации

**Файл:** [`src/app/api/shell/events/sse/route.ts`](src/app/api/shell/events/sse/route.ts)

**Проблема:** Endpoint принимает подключения без проверки сессии. Любой неавторизованный пользователь может:
- Подключиться к `/api/shell/events/sse`
- Получать все доменные события системы (создание оборудования, движения ТМЦ, согласования)
- Извлекать чувствительные данные (equipmentCode, имена, статусы)

**Решение:**
```typescript
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... дальше логика SSE
}
```

---

### SEC-05: Metrics и Health endpoints раскрывают информацию

**Файлы:**
- [`src/app/api/metrics/route.ts`](src/app/api/metrics/route.ts) — Prometheus метрики
- [`src/app/api/health/route.ts`](src/app/api/health/route.ts) — health check

**Проблема:**
- `/api/metrics` — раскрывает DB latency, memory usage, uptime без авторизации
- `/api/health` — раскрывает версию приложения, состояние сервисов

**Риск:** Атакующий может использовать для reconnaissance (определение версий, нагрузки, уязвимостей).

**Решение:**
1. Ограничить доступ к `/api/metrics` по IP (только Prometheus scraper)
2. В `/api/health` убрать версию приложения из публичного ответа
3. Добавить отдельный `/api/health/detailed` для авторизованных админов

---

### SEC-06: Files preview/download без проверки scope

**Файлы:**
- [`src/app/api/files/preview/route.ts`](src/app/api/files/preview/route.ts)
- [`src/app/api/files/download/route.ts`](src/app/api/files/download/route.ts)

**Проблема:**
```typescript
// preview/route.ts:23 — пользователь контролирует путь
const path = req.nextUrl.searchParams.get("path") || "";
// Нет привязки к документу/оборудованию, нет проверки прав
```

**Риск:** Авторизованный пользователь с минимальными правами (например, VIEWER) может читать любые файлы системы, зная путь.

**Решение:**
1. Привязать файлы к сущностям (Document, Equipment) через ID
2. Проверять права доступа к сущности перед выдачей файла
3. Использовать подписанные URL с коротким TTL вместо прямого пути

---

### SEC-07: Path traversal в storage providers

**Файлы:**
- [`src/lib/storage/provider.ts:31-37`](src/lib/storage/provider.ts:31)
- [`src/lib/storage/secure-provider.ts:27-36`](src/lib/storage/secure-provider.ts:27)

**Проблема:**
```typescript
// provider.ts:31-37 — проверка только на ".."
function safeRelativePath(value: string) {
  const normalized = normalize(value).replace(/^([/\\])+/, "");
  if (normalized.includes("..")) {
    throw new Error("Invalid storage path");
  }
  return normalized;
}
```

**Риск:** На Windows возможен обход через `..\` или символические ссылки. Также нет проверки на абсолютные пути после нормализации.

**Решение:**
```typescript
import { realpath } from "fs/promises";

async function safeRelativePath(value: string): Promise<string> {
  const normalized = path.normalize(value).replace(/^([/\\])+/, "");
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid storage path");
  }
  const resolved = path.resolve(ROOT_STORAGE_DIR, normalized);
  const realRoot = await realpath(ROOT_STORAGE_DIR);
  const realResolved = await realpath(resolved);
  if (!realResolved.startsWith(realRoot)) {
    throw new Error("Path traversal detected");
  }
  return normalized;
}
```

---

### SEC-08: Audit endpoint позволяет подделку логов

**Файл:** [`src/app/api/admin/audit/route.ts:108-171`](src/app/api/admin/audit/route.ts:108)

**Проблема:** Endpoint `POST /api/admin/audit` позволяет ADMIN записывать произвольные записи аудита с любым `userId`, `userEmail`, `action`, `details`.

**Риск:** Компрометированный admin-аккаунт может подделать логи, скрыть следы атаки.

**Решение:**
1. Убрать POST endpoint или ограничить только системными событиями
2. Добавить cryptographic signing для audit записей (HMAC)
3. Выделить отдельную таблицу `SystemAuditLog` (immutable) с append-only доступом

---

### SEC-09: Отсутствие CSRF защиты

**Файл:** [`src/lib/auth/session.ts:87`](src/lib/auth/session.ts:87)

**Проблема:**
```typescript
cookieStore.set(SESSION_COOKIE_NAME, token, {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "lax",  // Недостаточно для state-changing операций
  path: "/",
  maxAge: 2 * 60 * 60
});
```

**Риск:** CSRF-атаки на state-changing endpoints (POST, PUT, DELETE).

**Решение:**
1. Установить `sameSite: "strict"` для production
2. Добавить CSRF токены для критичных операций
3. Проверять `Origin` и `Referer` заголовки

---

### SEC-10: Cookie secure зависит от env переменной

**Файл:** [`src/lib/auth/session.ts:85`](src/lib/auth/session.ts:85)

**Проблема:**
```typescript
secure: process.env.COOKIE_SECURE === "true",
```

**Риск:** Если забыли установить `COOKIE_SECURE=true` в production, cookie будет передаваться по HTTP.

**Решение:**
```typescript
secure: process.env.NODE_ENV === "production", // Автоматически true в prod
```

---

## 🔴 P1 — ВЫСОКИЙ ПРИОРИТЕТ

### SEC-11: LDAP mock возвращает фиксированные роли

**Файл:** [`src/lib/auth/ldap.ts:46`](src/lib/auth/ldap.ts:46)

**Проблема:**
```typescript
if (process.env.LDAP_MOCK_SUCCESS === "true") {
  return {
    username,
    email: `${username}@${process.env.LDAP_DOMAIN || "company.local"}`,
    displayName: `AD User (${username})`,
    roles: ["VIEWER", "EDITOR"],  // Все получают одинаковые роли!
    adExternalId: `AD-${username.toUpperCase()}-GUID`
  };
}
```

**Решение:** Интегрировать реальный LDAP клиент (ldapjs) с маппингом AD групп → EMS роли.

---

### SEC-12: Нет валидации env переменных при старте

**Проблема:** Приложение не валидирует наличие и формат критичных env переменных при старте.

**Решение:** Добавить валидацию через Zod:
```typescript
import { z } from "zod";

const envSchema = z.object({
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  COOKIE_SECURE: z.enum(["true", "false"]).default("true"),
  NODE_ENV: z.enum(["development", "test", "production"]),
});

export const env = envSchema.parse(process.env);
```

---

### SEC-13: Нет HTTPS в nginx.conf

**Файл:** [`nginx.conf`](nginx.conf)

**Проблема:** Конфигурация поддерживает только HTTP. Нет SSL/TLS termination.

**Решение:** Добавить SSL конфигурацию с Let's Encrypt или корпоративным сертификатом.

---

### SEC-14: Нет healthcheck для приложения в docker-compose

**Файл:** [`docker-compose.yml`](docker-compose.yml)

**Проблема:** Healthcheck есть только для postgres и minio, но не для самого приложения.

**Решение:**
```yaml
app:
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

---

### SEC-15: Нет backup стратегии для PostgreSQL

**Проблема:** В `docker-compose.yml` нет volumes для backup, нет cron задач для pg_dump.

**Решение:**
1. Добавить отдельный сервис `postgres-backup` с cron
2. Настроить retention policy (7 дней daily, 4 недели weekly, 12 месяцев monthly)
3. Тестировать восстановление из backup регулярно

---

### SEC-16: Нет CORS конфигурации

**Файл:** [`next.config.ts`](next.config.ts)

**Проблема:** Отсутствует явная CORS политика. По умолчанию Next.js разрешает same-origin только.

**Решение:** Добавить явную CORS конфигурацию для API endpoints, если требуется доступ с других доменов.

---

### SEC-17: Нет rate limiting для отдельных критичных endpoints

**Файл:** [`nginx.conf:32-40`](nginx.conf:32)

**Проблема:** Общий rate limit для `/api/` (30r/s), но нет отдельных лимитов для:
- `/api/auth/login` (только application-level)
- `/api/files/upload` (защита от DoS)
- `/api/admin/*` (защита от brute-force admin endpoints)

**Решение:**
```nginx
location /api/auth/login {
  limit_req zone=login_limit burst=5 nodelay;
  proxy_pass http://ems-app:3000;
}

location /api/files/upload {
  limit_req zone=upload_limit burst=10 nodelay;
  client_max_body_size 20M;
  proxy_pass http://ems-app:3000;
}
```

---

## 🟡 P2 — СРЕДНИЙ ПРИОРИТЕТ

### CODE-01: Использование `as unknown as` для обхода типизации

**Файлы:**
- [`src/app/api/modules/eps/equipment/route.ts:215`](src/app/api/modules/eps/equipment/route.ts:215)
- [`src/app/api/modules/eps/equipment/[id]/route.ts:243`](src/app/api/modules/eps/equipment/[id]/route.ts:243)

**Проблема:** Обход типизации Prisma может скрыть ошибки.

**Решение:** Обновить Prisma schema или использовать правильные типы.

---

### CODE-02: Использование `any` в нескольких местах

**Файлы:**
- [`src/lib/storage/secure-provider.ts`](src/lib/storage/secure-provider.ts)
- [`src/lib/storage/s3.ts`](src/lib/storage/s3.ts)

**Решение:** Заменить на конкретные типы или `unknown` с проверками.

---

### CODE-03: Нет graceful shutdown для Prisma

**Файл:** [`src/lib/db/prisma.ts`](src/lib/db/prisma.ts)

**Проблема:** При остановке приложения PrismaClient не закрывается корректно, что может привести к потере соединений.

**Решение:**
```typescript
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
```

---

### CODE-04: Нет connection pooling для Prisma

**Файл:** [`src/lib/db/prisma.ts`](src/lib/db/prisma.ts)

**Решение:** Добавить параметры пула в DATABASE_URL:
```
postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

---

### PERF-01: N+1 проблемы в getUserWarehouseAccess

**Файл:** [`src/lib/auth/wms-rbac.ts:35-130`](src/lib/auth/wms-rbac.ts:35)

**Проблема:** Несколько последовательных запросов к БД (WarehouseKeeper, UserRole, Warehouse).

**Решение:** Использовать `Promise.all` для параллельных запросов или JOIN.

---

### PERF-02: Нет кеширования для справочников

**Файлы:**
- [`src/lib/auth/permissions-registry.ts`](src/lib/auth/permissions-registry.ts)
- [`src/lib/config/modules.ts`](src/lib/config/modules.ts)

**Решение:** Добавить in-memory кеш с TTL для редко меняющихся данных.

---

### PERF-03: Нет индексов на критичных полях

**Файл:** [`prisma/schema.prisma`](prisma/schema.prisma)

**Проблема:** Например, `Equipment.inventoryNumber` имеет `@unique`, но нет составных индексов для частых запросов (по `department + status`, `type + category`).

**Решение:** Добавить индексы на основе анализа реальных запросов.

---

### TEST-01: Минимальное покрытие тестами

**Файлы:**
- [`src/lib/auth/__tests__/session-security.test.ts`](src/lib/auth/__tests__/session-security.test.ts)
- [`src/lib/validations/__tests__/wms-validation.test.ts`](src/lib/validations/__tests__/wms-validation.test.ts)
- [`src/lib/wms/__tests__/idempotency-concurrency.test.ts`](src/lib/wms/__tests__/idempotency-concurrency.test.ts)
- [`src/__tests__/security-and-wms.test.ts`](src/__tests__/security-and-wms.test.ts)

**Проблема:** Покрытие ~10-15%. Нет тестов для:
- Equipment CRUD
- WMS movements
- Outbox processor
- Event bus
- Storage providers
- API endpoints (integration tests)

**Решение:**
1. Добавить unit-тесты для всех критичных модулей (цель: 70%+ coverage)
2. Добавить integration-тесты для API endpoints
3. Добавить E2E тесты (Playwright) для ключевых сценариев
4. Настроить CI/CD с автоматическим запуском тестов

---

### DOC-01: Версии в документации и коде не совпадают

**Проблема:**
- `package.json`: `"version": "2.3.7"`
- `docs/rules/*.md`: `> **Версия:** 2.3.7`
- `src/lib/version.ts`: `export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "2.4.0";`

**Решение:** Синхронизировать версии, использовать единый источник.

---

### DOC-02: Нет API документации

**Решение:** Добавить OpenAPI/Swagger спецификацию для всех API endpoints.

---

### DOC-03: Нет ADR (Architecture Decision Records)

**Решение:** Создать `/docs/adr/` с записями ключевых архитектурных решений.

---

## 🟢 P3 — НИЗКИЙ ПРИОРИТЕТ

### UX-01: Нет loading states в критичных местах

**Решение:** Добавить skeleton loaders для всех async операций.

---

### UX-02: Нет error boundaries для модулей

**Файл:** [`src/app/error.tsx`](src/app/error.tsx)

**Проблема:** Есть только global-error.tsx, но нет module-specific error boundaries.

**Решение:** Добавить `error.tsx` в каждую папку модуля.

---

### UX-03: Нет offline support

**Решение:** Добавить Service Worker для базового offline режима (только для чтения).

---

### MONITOR-01: Нет alerting на критичные события

**Проблема:** Логирование работает, но нет alerting на:
- Множественные неудачные попытки входа
- Circuit breaker срабатывания
- Outbox failures
- Storage failures

**Решение:** Интегрировать с Prometheus Alertmanager или PagerDuty.

---

### MONITOR-02: Нет distributed tracing

**Решение:** Добавить OpenTelemetry для трейсинга запросов между модулями.

---

## 📋 План устранения (Roadmap)

### Фаза 1: Критические блокеры (1-2 недели)
1. ✅ Удалить хардкоженные секреты (SEC-01)
2. ✅ Закрыть MOCK_USERS бэкдор (SEC-02)
3. ✅ Добавить авторизацию на SSE (SEC-04)
4. ✅ Защитить metrics/health endpoints (SEC-05)
5. ✅ Добавить проверку scope для файлов (SEC-06)
6. ✅ Исправить path traversal (SEC-07)
7. ✅ Убрать POST audit endpoint (SEC-08)
8. ✅ Усилить cookie security (SEC-09, SEC-10)

### Фаза 2: Инфраструктура (2-3 недели)
1. ✅ Мигрировать in-memory хранилища на Redis (SEC-03)
2. ✅ Добавить валидацию env переменных (SEC-12)
3. ✅ Настроить HTTPS в nginx (SEC-13)
4. ✅ Добавить healthcheck для приложения (SEC-14)
5. ✅ Настроить backup PostgreSQL (SEC-15)
6. ✅ Добавить rate limiting для критичных endpoints (SEC-17)

### Фаза 3: Качество и тестирование (3-4 недели)
1. ✅ Увеличить покрытие тестами до 70%+ (TEST-01)
2. ✅ Добавить integration и E2E тесты
3. ✅ Настроить CI/CD pipeline
4. ✅ Исправить типизацию (CODE-01, CODE-02)
5. ✅ Добавить graceful shutdown (CODE-03)
6. ✅ Оптимизировать производительность (PERF-01, PERF-02, PERF-03)

### Фаза 4: Документация и мониторинг (1-2 недели)
1. ✅ Синхронизировать версии (DOC-01)
2. ✅ Создать OpenAPI спецификацию (DOC-02)
3. ✅ Написать ADR (DOC-03)
4. ✅ Настроить alerting (MONITOR-01)
5. ✅ Добавить distributed tracing (MONITOR-02)

---

## 🎯 Рекомендации для немедленного внедрения

### Quick Wins (можно сделать за 1-2 дня):

1. **Удалить fallback секреты** — 30 минут
2. **Закрыть MOCK_USERS в production** — 1 час
3. **Добавить авторизацию на SSE** — 30 минут
4. **Ограничить доступ к /api/metrics** — 1 час
5. **Убрать версию из /api/health** — 15 минут
6. **Добавить проверку scope для файлов** — 4 часа
7. **Установить `secure: true` автоматически в prod** — 15 минут
8. **Добавить валидацию env переменных** — 2 часа

### Критичные исправления (1-2 недели):

1. **Миграция на Redis** для token blacklist, rate limiter, event bus
2. **Интеграция реального LDAP** вместо mock
3. **Настройка HTTPS** в nginx
4. **Добавление backup стратегии**
5. **Увеличение покрытия тестами** до 50%+

---

## 📞 Контакты

Для вопросов по аудиту и плану устранения:
- **Security issues:** требуют немедленного внимания
- **Infrastructure:** можно планировать на следующий спринт
- **Code quality:** можно включить в текущий спринт

---

**Статус:** 🔴 **НЕ ГОТОВ К PRODUCTION**  
**Рекомендация:** Устранить все P0 уязвимости перед выпуском. После Фазы 1-2 возможен limited production rollout с мониторингом.
