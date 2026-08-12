# EMS Shell — Обзор архитектуры и правила интеграции

> **Версия документа:** 2.3.7  
> **Назначение:** Контекст для разработчиков, интегрирующих новые модули в платформу EMS  
> **Аудитория:** Backend/Frontend инженеры, архитекторы, DevOps

---

## 1. Что такое EMS Shell

**EMS (Enterprise Management System)** — корпоративная модульная платформа промышленного предприятия. Архитектура построена по принципу **«Shell + Modules»**:

```
┌─────────────────────────────────────────────────────────────┐
│                        EMS Shell                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │   EPS    │  │   WMS    │  │   MRO    │  │    SRM     │  │
│  │ (online) │  │ (online) │  │   (dev)  │  │   (dev)    │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Cross-cutting Services (EventBus, Cron, Webhooks,   │   │
│  │  Circuit Breaker, Outbox, Storage, Logger, RBAC)     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Shell** — это ядро платформы, которое:
- Управляет аутентификацией и авторизацией (RBAC + scope)
- Предоставляет кросс-модульные сервисы (события, хранилище, webhook'и)
- Маршрутизирует запросы через middleware
- Регистрирует и мониторит состояние модулей (Circuit Breaker)
- Предоставляет UI-оболочку (sidebar, topbar, layout)

**Module** — это бизнес-вертикаль (EPS, WMS, MRO, SRM), которая:
- Реализует свою предметную область
- Использует сервисы Shell через стабильный API
- Регистрируется через манифест ([`src/lib/config/modules.ts`](../../src/lib/config/modules.ts))
- Может расширять UI через UI-slots

---

## 2. Технологический стек

| Слой | Технология | Версия |
|------|-----------|--------|
| Framework | Next.js (App Router, Standalone) | 16.2.12 |
| UI Runtime | React | 19.2.4 |
| Language | TypeScript | 5.9.3 |
| ORM | Prisma Client | 5.17.0 |
| Database | PostgreSQL | 16-alpine |
| Object Storage | MinIO (S3-compatible) | RELEASE.2024-01-16 |
| Auth | jose (JWT HS256) | 6.2.7 |
| Validation | Zod | 4.4.3 |
| Hashing | bcryptjs | 3.0.3 |
| Styling | Tailwind CSS + CVA | 3.4.17 / 0.7.1 |
| Icons | lucide-react | 1.28.0 |
| Testing | Vitest | 4.1.10 |

---

## 3. Структура каталогов

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── admin/                # Админские эндпоинты
│   │   ├── modules/
│   │   │   ├── eps/              # EPS API
│   │   │   └── wms/              # WMS API
│   │   ├── reference/            # Справочники
│   │   ├── shell/                # Shell API (cron, events, modules)
│   │   └── auth/                 # Аутентификация
│   ├── modules/                  # Страницы модулей
│   │   ├── eps/
│   │   └── wms/
│   ├── admin/                    # Админ-панель
│   ├── login/                    # Страница входа
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Дашборд Shell
│
├── components/                   # React компоненты
│   ├── layout/                   # Shell layout (sidebar, topbar, etc.)
│   ├── ui/                       # UI kit (30+ компонентов)
│   ├── eps/                      # EPS-специфичные компоненты
│   ├── wms/                      # WMS-специфичные компоненты
│   └── admin/                    # Админ-компоненты
│
├── lib/                          # Бизнес-логика и сервисы
│   ├── auth/                     # Аутентификация и RBAC
│   ├── shell/                    # Кросс-модульные сервисы Shell
│   ├── wms/                      # Бизнес-логика WMS
│   ├── storage/                  # Абстракция хранилища
│   ├── webhooks/                 # Webhook диспетчер
│   ├── plugins/                  # Plugin system
│   ├── events/                   # Event bus
│   ├── telemetry/                # Логирование
│   ├── db/                       # Prisma client
│   ├── validations/              # Zod схемы
│   ├── config/                   # Конфигурация (modules, nav, brand)
│   └── utils/                    # Утилиты
│
├── types/                        # TypeScript типы
├── middleware.ts                 # Next.js middleware (Edge Runtime)
└── __tests__/                    # Интеграционные тесты

prisma/
├── schema.prisma                 # Схема БД (25+ моделей)
├── migrations/                   # Миграции
└── seed.ts                       # Seed данные
```

---

## 4. Ключевые принципы

### 4.1. Defense in Depth
Безопасность реализована на всех уровнях:
- **Edge Middleware** — проверка JWT, базовый RBAC
- **API Guards** — `requireSession()`, `requireRole()`, `requireModulePermission()`
- **Zod валидация** — все входные данные
- **Scope-based RBAC** — ограничение по складам/подразделениям
- **CSP + Security Headers** — на уровне Next.js и Nginx

### 4.2. Deny by Default
Все операции по умолчанию требуют явной авторизации. Если роль не указана в матрице — доступ запрещён.

### 4.3. Audit Everything
Все значимые действия записываются в `AuditLog` через [`logEvent()`](../../src/lib/telemetry/logger.ts:56) с before/after state, IP, User-Agent.

### 4.4. Transactional Outbox
Доменные события записываются в БД в той же транзакции, что и бизнес-операция. Фоновый процессор гарантирует доставку.

### 4.5. Versioning
Изменения критичных сущностей (Equipment, Document) сохраняются как версии с JSON snapshot.

### 4.6. Plugin-First
Новый функционал должен быть реализован как модуль с манифестом, а не как хардкод в Shell.

---

## 5. Документация по разделам

| # | Документ | Описание |
|---|----------|----------|
| 01 | [Shell Architecture](./01-shell-architecture.md) | Детальная архитектура Shell, кросс-модульные сервисы |
| 02 | [Module Integration](./02-module-integration.md) | Пошаговое руководство по интеграции нового модуля |
| 03 | [RBAC System](./03-rbac-system.md) | Система ролей, разрешений, scope |
| 04 | [Event Bus](./04-event-bus.md) | Публикация и подписка на доменные события |
| 05 | [Storage](./05-storage.md) | Абстракция хранилища (Local + S3) |
| 06 | [Webhooks](./06-webhooks.md) | Интеграция с внешними системами |
| 07 | [API Conventions](./07-api-conventions.md) | Стандарты API, форматы ответов, валидация |
| 08 | [Security](./08-security.md) | Правила безопасности, JWT, rate limiting |
| 09 | [Testing](./09-testing.md) | Стратегия тестирования |
| 10 | [UI Conventions](./10-ui-conventions.md) | Стандарты UI, компоненты, layout |

---

## 6. Быстрый старт для нового модуля

```typescript
// 1. Зарегистрировать модуль в src/lib/config/modules.ts
export const MODULES_CONFIG = {
  // ...существующие модули
  mymodule: {
    id: "mymodule",
    name: "My Module",
    href: "/modules/mymodule",
    version: "v1.0.0",
    status: "online",
    description: "Описание модуля",
    iconName: "Box",
    requiredRoles: ["ADMIN", "EDITOR"],
    healthEndpoint: "/api/modules/mymodule/health",
    navItems: [
      {
        id: "nav-mymodule-main",
        title: "Главная",
        href: "/modules/mymodule",
        keywords: ["mymodule", "main"],
        iconName: "Home"
      }
    ]
  }
};

// 2. Создать страницу src/app/modules/mymodule/page.tsx
// 3. Создать API src/app/api/modules/mymodule/[resource]/route.ts
// 4. Добавить разрешения в src/lib/auth/permissions-registry.ts
// 5. Добавить middleware-правила в src/middleware.ts (если нужны особые проверки)
```

Подробнее — в [02-module-integration.md](./02-module-integration.md).

---

## 7. Контакты и поддержка

- **Документация:** `/docs/rules/`
- **Архитектурные решения:** обсуждаются через ADR (Architecture Decision Records)
- **Безопасность:** все SEC-* метки в коде указывают на конкретные требования
