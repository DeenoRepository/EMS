# Security

> **Версия:** 2.3.7  
> **Расположение кода:** [`src/lib/auth/`](../../src/lib/auth/), [`src/middleware.ts`](../../src/middleware.ts), [`next.config.ts`](../../next.config.ts), [`nginx.conf`](../../nginx.conf)

---

## 1. Обзор

EMS реализует **Defense in Depth** — многоуровневую защиту на всех уровнях приложения.

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
│                                                             │
│  Layer 1: Network (Nginx)                                   │
│    - Rate limiting                                          │
│    - Security headers                                       │
│    - SSL/TLS termination                                    │
│                                                             │
│  Layer 2: Edge Middleware                                   │
│    - JWT verification                                       │
│    - Basic RBAC                                             │
│                                                             │
│  Layer 3: API Guards                                        │
│    - Session validation                                     │
│    - Permission checks                                      │
│    - Scope validation                                       │
│                                                             │
│  Layer 4: Input Validation                                  │
│    - Zod schemas                                            │
│    - Type checking                                          │
│                                                             │
│  Layer 5: Business Logic                                    │
│    - State machines                                         │
│    - Idempotency                                            │
│                                                             │
│  Layer 6: Data Layer                                        │
│    - Prisma ORM (SQL injection prevention)                   │
│    - Encrypted storage                                      │
│                                                             │
│  Layer 7: Audit                                             │
│    - All actions logged                                     │
│    - Tamper-evident trail                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Аутентификация

### 2.1. JWT (JSON Web Token)

**Алгоритм:** HS256  
**Библиотека:** `jose`  
**TTL:** 2 часа (SEC-10)  
**Cookie:** `ems_session` (httpOnly, secure, sameSite=lax)

#### Структура токена

```typescript
{
  id: "usr-editor",
  username: "editor",
  displayName: "Инженер Редактор",
  email: "editor@ems.local",
  roles: ["eps_engineer"],
  jti: "jti_1704067200_abc123"
}
```

#### Заголовки

```typescript
{
  alg: "HS256",
  typ: "JWT"
}
```

#### Claims

- `iss` — "ems-auth-service"
- `aud` — "ems-app"
- `iat` — issued at
- `exp` — expiration (now + 2h)
- `jti` — unique token ID

### 2.2. Создание токена

```typescript
import { createSessionToken } from "@/lib/auth/session";

const token = await createSessionToken({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  email: user.email,
  roles: user.roles
});
```

### 2.3. Верификация токена

```typescript
import { verifySessionToken } from "@/lib/auth/session";

const session = await verifySessionToken(token);
if (!session) {
  // Невалидный или истёкший токен
}
```

### 2.4. JWT_SECRET

**Критически важно:**
- Минимум 32 байта случайных данных
- Хранить в `.env`, не в коде
- Ротировать регулярно
- В production обязателен (иначе ошибка при старте)

```typescript
function getJwtSecret(): Uint8Array {
  const secretKey = process.env.JWT_SECRET || 
    (process.env.NODE_ENV !== "production" 
      ? "ems-dev-jwt-secret-key-for-local-development-only-32bytes" 
      : "");
  
  if (!secretKey) {
    throw new Error("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is mandatory!");
  }
  
  return new TextEncoder().encode(secretKey);
}
```

---

## 3. Token Blacklist (SEC-11)

### 3.1. Назначение

Мгновенный отзыв JWT-токенов (logout, компрометация).

### 3.2. Реализация

```typescript
import { revokeToken, isTokenRevoked } from "@/lib/auth/token-blacklist";

// Отзыв токена
revokeToken(token, 2 * 60 * 60); // TTL = 2 часа

// Проверка
if (isTokenRevoked(token)) {
  // Токен отозван
}
```

### 3.3. Особенности

- Edge Runtime compatible (FNV fallback hash)
- Автоматическая очистка просроченных записей (каждые 15 мин)
- In-memory хранилище (для production — Redis)

### 3.4. Logout

```typescript
export async function POST(request: Request) {
  const token = request.cookies.get("ems_session")?.value;
  
  if (token) {
    revokeToken(token);
  }
  
  // Очистить cookie
  const response = NextResponse.json({ success: true });
  response.cookies.delete("ems_session");
  
  return response;
}
```

---

## 4. Авторизация (RBAC)

См. подробности в [03-rbac-system.md](./03-rbac-system.md).

**Краткий обзор:**
- Двухуровневая система: роли + разрешения
- Scope-based ограничения (склады, подразделения)
- Deny by default
- Guards для API routes

---

## 5. Rate Limiting (SEC-14)

### 5.1. Application Level (Login)

```typescript
import { checkLoginRateLimit, registerFailedLoginAttempt, resetLoginAttempts } from "@/lib/auth/rate-limiter";

const identifier = `${ip}:${username}`;
const rateLimit = checkLoginRateLimit(identifier);

if (rateLimit.isBlocked) {
  return NextResponse.json(
    { 
      error: "Слишком много попыток входа",
      retryAfter: rateLimit.retryAfterSeconds 
    },
    { status: 429 }
  );
}

// При неудаче
registerFailedLoginAttempt(identifier);

// При успехе
resetLoginAttempts(identifier);
```

**Параметры:**
- Максимум попыток: 5
- Окно блокировки: 15 минут

### 5.2. Nginx Level (API)

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

location /api/ {
  limit_req zone=api_limit burst=20 nodelay;
  proxy_pass http://ems-app:3000;
}
```

**Параметры:**
- Rate: 30 запросов/сек
- Burst: 20 запросов
- Zone: 10 MB (≈ 160k IP)

---

## 6. Input Validation

### 6.1. Zod Schemas

Все входные данные валидируются через Zod:

```typescript
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"])
});

const result = schema.safeParse(input);
if (!result.success) {
  // Обработка ошибок валидации
}
```

### 6.2. SQL Injection Prevention

Prisma ORM автоматически защищает от SQL injection через параметризованные запросы:

```typescript
// ✅ Безопасно (Prisma)
await prisma.user.findMany({
  where: { email: userInput }
});

// ❌ Опасно (raw SQL без параметров)
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${userInput}'`);
```

**Правило:** Никогда не использовать `$queryRawUnsafe` с пользовательским вводом. Использовать `$queryRaw` с тегированными шаблонами:

```typescript
// ✅ Безопасно
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${userInput}`;
```

### 6.3. XSS Prevention

React автоматически экранирует значения в JSX:

```typescript
// ✅ Безопасно (React экранирует)
<div>{userInput}</div>

// ❌ Опасно (dangerouslySetInnerHTML)
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

**Правило:** Никогда не использовать `dangerouslySetInnerHTML` без санитизации.

### 6.4. Path Traversal Prevention

```typescript
import { safeRelativePath } from "@/lib/storage/provider";

function safeRelativePath(value: string) {
  const normalized = normalize(value).replace(/^([/\\])+/, "");
  if (normalized.includes("..")) {
    throw new Error("Invalid storage path");
  }
  return normalized;
}
```

---

## 7. Security Headers

### 7.1. Next.js ([`next.config.ts`](../../next.config.ts))

```typescript
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' data: https://fonts.gstatic.com;
  img-src 'self' data: blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`;
```

**Заголовки:**
- `Content-Security-Policy` — строгая CSP
- `Strict-Transport-Security` — HSTS (2 года + preload)
- `X-Frame-Options: DENY` — защита от clickjacking
- `X-Content-Type-Options: nosniff` — защита от MIME sniffing
- `Referrer-Policy: origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 7.2. Nginx ([`nginx.conf`](../../nginx.conf))

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header Content-Security-Policy "..." always;
```

---

## 8. Cookie Security

### 8.1. Настройки

```typescript
cookieStore.set(SESSION_COOKIE_NAME, token, {
  httpOnly: true,                                    // Недоступен из JS
  secure: process.env.COOKIE_SECURE === "true",     // Только HTTPS (production)
  sameSite: "lax",                                   // CSRF protection
  path: "/",
  maxAge: 2 * 60 * 60                               // 2 часа
});
```

### 8.2. Флаги

- `httpOnly: true` — защита от XSS
- `secure: true` (production) — только HTTPS
- `sameSite: "lax"` — защита от CSRF
- `maxAge: 7200` — соответствует JWT TTL

---

## 9. LDAP / AD Integration

### 9.1. Конфигурация

```bash
LDAP_URL=ldaps://ldap.company.local:636
LDAP_BASE_DN=DC=company,DC=local
LDAP_BIND_DN=CN=service,OU=Service,DC=company,DC=local
LDAP_BIND_PASSWORD=...
LDAP_DOMAIN=company.local
```

### 9.2. Mock Mode (только dev/test)

```bash
LDAP_MOCK_SUCCESS=true  # Только в development/test!
```

**Защита:**
```typescript
if (isLdapMockEnabled && !isLdapMockEnvironment) {
  throw new Error(
    "CRITICAL SECURITY ERROR: LDAP_MOCK_SUCCESS is only allowed in development or test"
  );
}
```

### 9.3. Fallback

Если LDAP не сконфигурирован, используется in-memory `MOCK_USERS` (только dev).

---

## 10. Audit Logging

### 10.1. Назначение

Все значимые действия записываются в `AuditLog` для:
- Расследования инцидентов
- Compliance (требования регуляторов)
- Отслеживания изменений

### 10.2. Что логировать

- Создание/обновление/удаление сущностей
- Изменение статусов
- Согласования (approve/reject)
- Экспорт данных
- Изменения в админ-панели
- Неудачные попытки входа
- Отказы в доступе

### 10.3. Структура записи

```typescript
{
  id: "log_123",
  actorId: "usr-editor",
  actorEmail: "editor@ems.local",
  action: "CREATE",  // CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN, EXPORT
  entityType: "Equipment",
  entityId: "eq_123",
  beforeState: null,  // JSON
  afterState: { ... }, // JSON
  metadata: { ... },   // JSON
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  requestId: "req_1704067200_abc",
  createdAt: "2026-08-12T15:00:00.000Z"
}
```

### 10.4. Использование

```typescript
import { logEvent } from "@/lib/telemetry/logger";

logEvent({
  level: "audit",
  module: "EPS",
  action: "EQUIPMENT_CREATED",
  userId: session.id,
  userEmail: session.email,
  details: {
    equipmentId: created.id,
    code: created.equipmentCode
  }
});
```

---

## 11. File Upload Security

### 11.1. Валидация

```typescript
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "text/plain"
]);

const maxBytes = 20 * 1024 * 1024; // 20 MB
```

### 11.2. Sanitization

```typescript
const storedName = `${randomUUID()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
```

### 11.3. Checksum

```typescript
const checksum = createHash("sha256").update(input.bytes).digest("hex");
```

---

## 12. Webhook Security

### 12.1. HMAC Signature

```typescript
import crypto from "crypto";

function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
```

### 12.2. Headers

```
X-EMS-Signature: <hmac-sha256>
X-EMS-Event: <event-type>
X-EMS-Event-Id: <event-id>
```

### 12.3. Проверка на стороне получателя

```python
import hmac
import hashlib

def verify_webhook(payload: str, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

---

## 13. Secrets Management

### 13.1. Переменные окружения

Все секреты хранятся в `.env` (не в коде):

```bash
# .env (НЕ коммитить!)
JWT_SECRET=<32+ random bytes>
POSTGRES_PASSWORD=<strong password>
S3_ACCESS_KEY=<access key>
S3_SECRET_KEY=<secret key>
LDAP_BIND_PASSWORD=<password>
```

### 13.2. .env.example

Шаблон с пустыми значениями:

```bash
# .env.example (коммитить)
JWT_SECRET=
POSTGRES_PASSWORD=
S3_ACCESS_KEY=
S3_SECRET_KEY=
```

### 13.3. Docker Secrets (production)

Для production использовать Docker Secrets или внешний Vault:

```yaml
services:
  app:
    secrets:
      - jwt_secret
      - db_password

secrets:
  jwt_secret:
    external: true
  db_password:
    external: true
```

---

## 14. Security Checklist

### 14.1. Перед деплоем

```
□ JWT_SECRET задан (≥ 32 байта)
□ POSTGRES_PASSWORD сильный (≥ 16 символов)
□ S3_ACCESS_KEY и S3_SECRET_KEY заданы
□ COOKIE_SECURE=true в production
□ LDAP_MOCK_SUCCESS=false в production
□ HTTPS настроен (SSL сертификаты)
□ Security headers проверены
□ CSP проверена
□ Rate limiting работает
□ Audit logging включён
□ Backup БД настроен
□ Мониторинг настроен
```

### 14.2. При разработке

```
□ Все входы валидируются через Zod
□ Нет raw SQL с пользовательским вводом
□ Нет dangerouslySetInnerHTML без санитизации
□ Нет console.log с чувствительными данными
□ Нет хардкода секретов в коде
□ Все API endpoints проверяют сессию
□ Все API endpoints проверяют разрешения
□ Значимые операции логируются
□ Транзакции используются для связанных операций
□ Ошибки не раскрывают внутреннюю информацию
```

---

## 15. Incident Response

### 15.1. Компрометация JWT_SECRET

1. Немедленно сменить `JWT_SECRET`
2. Все текущие токены станут невалидными
3. Пользователям потребуется повторный вход
4. Проверить audit log на подозрительную активность

### 15.2. Подозрительная активность

1. Проверить `AuditLog` через `/admin/audit`
2. Заблокировать пользователя через `/admin/rbac`
3. Отозвать все токены пользователя
4. Проверить логи Nginx на подозрительные IP

### 15.3. Утечка данных

1. Сменить все секреты
2. Проверить доступ к БД и S3
3. Уведомить затронутых пользователей
4. Провести аудит безопасности

---

## 16. Compliance

### 16.1. GDPR

- Минимизация данных (собирать только необходимое)
- Право на удаление (реализовать через soft delete)
- Право на экспорт (реализовать через API)
- Согласие на обработку (документировать)

### 16.2. Аудит

- Все действия пользователей логируются
- Логи хранятся минимум 1 год
- Доступ к логам только для ADMIN

---

## 17. Лучшие практики

✅ **Делать:**
- Использовать HTTPS везде
- Валидировать все входы через Zod
- Логировать значимые операции
- Использовать параметризованные запросы (Prisma)
- Хранить секреты в env переменных
- Регулярно обновлять зависимости
- Проводить code review с фокусом на безопасность

❌ **Не делать:**
- Не хранить секреты в коде
- Не использовать `dangerouslySetInnerHTML`
- Не использовать `$queryRawUnsafe` с пользовательским вводом
- Не отключать security headers
- Не игнорировать warnings от линтеров
- Не коммитить `.env` файлы
