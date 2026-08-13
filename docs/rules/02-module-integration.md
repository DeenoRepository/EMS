# Интеграция нового модуля

> **Целевая аудитория:** Разработчики, добавляющие новые бизнес-модули в EMS

---

## 1. Чеклист интеграции

```
□ 1. Зарегистрировать модуль в MODULES_CONFIG
□ 2. Добавить разрешения в permissions-registry
□ 3. Создать Prisma модели (если нужны)
□ 4. Создать API routes
□ 5. Создать страницы модуля
□ 6. Добавить middleware-правила (если нужны)
□ 7. Реализовать health-check эндпоинт
□ 8. Добавить UI-slots (опционально)
□ 9. Написать тесты
□ 10. Обновить документацию
```

---

## 2. Шаг 1: Регистрация модуля

Отредактируйте [`src/lib/config/modules.ts`](../../src/lib/config/modules.ts):

```typescript
export const MODULES_CONFIG: Record<string, ModuleManifest> = {
  // ...существующие модули
  
  mymodule: {
    id: "mymodule",
    name: "My Module",
    href: "/modules/mymodule",
    version: "v1.0.0",
    status: "online", // "online" | "dev" | "offline"
    description: "Краткое описание модуля для UI",
    iconName: "Box", // Имя иконки из lucide-react
    requiredRoles: ["ADMIN", "EDITOR"], // Минимальные роли для доступа
    healthEndpoint: "/api/modules/mymodule/health",
    settingsRoute: "/admin/settings/mymodule", // Опционально
    
    // Навигационные пункты в sidebar
    navItems: [
      {
        id: "nav-mymodule-main",
        title: "Главная",
        href: "/modules/mymodule",
        keywords: ["mymodule", "main", "главная"],
        iconName: "Home"
      },
      {
        id: "nav-mymodule-settings",
        title: "Настройки",
        href: "/modules/mymodule/settings",
        keywords: ["settings", "настройки"],
        iconName: "Settings"
      }
    ],
    
    // Категории справочников (опционально)
    nsiCategories: [
      {
        id: "mymodule-categories",
        name: "Категории",
        description: "Классификатор сущностей модуля",
        apiEndpoint: "/api/modules/mymodule/categories"
      }
    ],
    
    // UI-slots для расширения Shell UI (опционально)
    uiSlots: [
      {
        slotId: "dashboard.widgets",
        componentId: "MyModuleWidget",
        title: "My Module Widget",
        order: 10,
        requiredRoles: ["ADMIN"]
      }
    ],
    
    // AI capabilities (резерв для MCP интеграции)
    aiCapabilities: {
      exportableTools: ["mymodule.search", "mymodule.create"],
      supportedIntentActions: ["search", "create", "update"]
    }
  }
};
```

**Важно:**
- `id` должен совпадать с ключом в `MODULES_CONFIG`
- `href` — путь к главной странице модуля
- `requiredRoles` — массив ролей, ANY из которых даёт доступ
- `iconName` — должен существовать в `lucide-react`

---

## 3. Шаг 2: Регистрация разрешений

Отредактируйте [`src/lib/auth/permissions-registry.ts`](../../src/lib/auth/permissions-registry.ts):

```typescript
export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // ...существующие разрешения
  
  // MyModule
  { 
    code: "mymodule.entities.read", 
    module: "mymodule", 
    moduleName: "My Module", 
    section: "entities", 
    sectionName: "Сущности", 
    action: "READ", 
    name: "Просмотр сущностей", 
    description: "Просмотр списка и деталей сущностей модуля" 
  },
  { 
    code: "mymodule.entities.create", 
    module: "mymodule", 
    moduleName: "My Module", 
    section: "entities", 
    sectionName: "Сущности", 
    action: "CREATE", 
    name: "Создание сущностей", 
    description: "Создание новых сущностей в модуле" 
  },
  { 
    code: "mymodule.entities.update", 
    module: "mymodule", 
    moduleName: "My Module", 
    section: "entities", 
    sectionName: "Сущности", 
    action: "UPDATE", 
    name: "Редактирование сущностей", 
    description: "Изменение существующих сущностей" 
  },
  { 
    code: "mymodule.entities.delete", 
    module: "mymodule", 
    moduleName: "My Module", 
    section: "entities", 
    sectionName: "Сущности", 
    action: "DELETE", 
    name: "Удаление сущностей", 
    description: "Удаление сущностей из модуля" 
  }
];
```

**Соглашения:**
- Формат кода: `{module}.{section}.{action}`
- `action` — одно из: `READ`, `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `EXPORT`, `EXECUTE`
- Группировка по `section` для UI в админ-панели

---

## 4. Шаг 3: Prisma модели

Добавьте модели в [`prisma/schema.prisma`](../../prisma/schema.prisma):

```prisma
model MyEntity {
  id          String   @id @default(cuid())
  name        String
  description String?
  status      String   @default("ACTIVE")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Связи
  createdById String?
  createdBy   User?   @relation(fields: [createdById], references: [id])
  
  @@index([name])
  @@index([status])
}
```

**После добавления моделей:**
```bash
npx prisma migrate dev --name add_mymodule_tables
npx prisma generate
```

---

## 5. Шаг 4: API Routes

Создайте структуру в [`src/app/api/modules/mymodule/`](../../src/app/api/modules/):

```
api/modules/mymodule/
├── health/
│   └── route.ts          # GET /api/modules/mymodule/health
├── entities/
│   ├── route.ts          # GET (list), POST (create)
│   └── [id]/
│       └── route.ts      # GET, PUT, DELETE
└── ...
```

### 5.1. Пример GET (list)

```typescript
// src/app/api/modules/mymodule/entities/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { z } from "zod";

const querySchema = z.object({
  query: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export async function GET(request: Request) {
  // 1. Проверка сессии
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  // 2. Проверка разрешения
  if (!hasPermission(session, "mymodule.entities.read")) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  // 3. Валидация параметров
  const { searchParams } = new URL(request.url);
  const parseResult = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Некорректные параметры", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { query, status, limit, offset } = parseResult.data;

  // 4. Запрос к БД
  try {
    const where: any = {};
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } }
      ];
    }
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.myEntity.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset
      }),
      prisma.myEntity.count({ where })
    ]);

    return NextResponse.json({ items, total, limit, offset });
  } catch (err) {
    console.error("MyModule entities query failed:", err);
    return NextResponse.json({ items: [], total: 0 });
  }
}
```

### 5.2. Пример POST (create)

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { logEvent } from "@/lib/telemetry/logger";
import { ShellEventBus } from "@/lib/shell/event-bus";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(2, "Название должно содержать минимум 2 символа"),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
});

export async function POST(request: Request) {
  // 1. Проверка сессии
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  // 2. Проверка разрешения
  if (!hasPermission(session, "mymodule.entities.create")) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  // 3. Парсинг и валидация
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный формат JSON" }, { status: 400 });
  }

  const validation = createSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Некорректные данные", details: validation.error.format() },
      { status: 400 }
    );
  }

  const data = validation.data;

  // 4. Создание с транзакцией и событием
  try {
    const created = await prisma.$transaction(async (tx) => {
      const entity = await tx.myEntity.create({
        data: {
          ...data,
          createdById: session.id
        }
      });

      // Публикация события
      await ShellEventBus.publish(
        "mymodule.entity.created",
        "MYMODULE",
        { entityId: entity.id, name: entity.name },
        `corr_${Date.now()}`
      );

      return entity;
    });

    // 5. Audit log
    logEvent({
      level: "audit",
      module: "MYMODULE",
      action: "ENTITY_CREATED",
      userId: session.id,
      userEmail: session.email,
      details: { entityId: created.id, name: created.name }
    });

    return NextResponse.json({ success: true, item: created }, { status: 201 });
  } catch (err) {
    console.error("MyModule entity creation failed:", err);
    return NextResponse.json({ error: "Ошибка создания" }, { status: 500 });
  }
}
```

### 5.3. Health Check

```typescript
// src/app/api/modules/mymodule/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ModuleCircuitBreaker } from "@/lib/shell/circuit-breaker";

export async function GET() {
  try {
    // Проверка доступности БД
    await prisma.$queryRaw`SELECT 1`;
    
    ModuleCircuitBreaker.recordSuccess("mymodule");
    
    return NextResponse.json({
      status: "healthy",
      module: "mymodule",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    ModuleCircuitBreaker.recordFailure("mymodule", String(err));
    return NextResponse.json(
      { status: "unhealthy", error: String(err) },
      { status: 503 }
    );
  }
}
```

---

## 6. Шаг 5: Страницы модуля

Создайте структуру в [`src/app/modules/mymodule/`](../../src/app/modules/):

```
app/modules/mymodule/
├── page.tsx              # Главная страница
├── [id]/
│   ├── page.tsx          # Детали сущности
│   └── edit/
│       └── page.tsx      # Редактирование
├── settings/
│   └── page.tsx          # Настройки модуля
└── ...
```

### 6.1. Пример главной страницы

```typescript
// src/app/modules/mymodule/page.tsx
"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";

export default function MyModulePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const res = await fetch("/api/modules/mymodule/entities");
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to load items:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8">
        <PageHeader
          title="My Module"
          description="Управление сущностями модуля"
          actions={
            <Button onClick={() => {/* navigate to create */}}>
              Создать
            </Button>
          }
        />
        
        <DataTable
          data={items}
          columns={[
            { key: "name", label: "Название" },
            { key: "status", label: "Статус" },
            { key: "updatedAt", label: "Обновлено" }
          ]}
          loading={loading}
        />
      </main>
    </ShellLayout>
  );
}
```

---

## 7. Шаг 6: Middleware-правила (опционально)

Если модуль требует специальных проверок на уровне middleware, отредактируйте [`src/middleware.ts`](../../src/middleware.ts):

```typescript
// Добавить после существующих правил
if (pathname.startsWith("/modules/mymodule/admin") && !hasRole(session, ["ADMIN"])) {
  const mymoduleUrl = new URL("/modules/mymodule", request.url);
  return NextResponse.redirect(mymoduleUrl);
}
```

---

## 8. Шаг 7: UI-slots (опционально)

Если модуль хочет добавить виджеты на дашборд или действия в sidebar:

```typescript
// В манифесте модуля (src/lib/config/modules.ts)
uiSlots: [
  {
    slotId: "dashboard.widgets",
    componentId: "MyModuleDashboardWidget",
    title: "My Module Stats",
    order: 10,
    requiredRoles: ["ADMIN", "EDITOR"]
  }
]
```

Затем реализовать рендер слота в соответствующем layout-компоненте Shell.

---

## 9. Шаг 8: Тесты

Создайте тесты в `src/lib/mymodule/__tests__/`:

```typescript
// src/lib/mymodule/__tests__/entities.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db/prisma";

describe("MyModule Entities", () => {
  beforeEach(async () => {
    // Setup
  });

  it("should create entity", async () => {
    const entity = await prisma.myEntity.create({
      data: { name: "Test Entity" }
    });
    expect(entity.name).toBe("Test Entity");
  });

  it("should validate name length", async () => {
    // Test Zod schema
  });
});
```

---

## 10. Шаг 9: Документация

Создайте `docs/modules/mymodule.md` с описанием:
- Назначение модуля
- API endpoints
- Модели данных
- События
- Разрешения

---

## 11. Полный пример минимального модуля

Минимальный модуль "Notes" (заметки):

```typescript
// 1. src/lib/config/modules.ts — добавить в MODULES_CONFIG
notes: {
  id: "notes",
  name: "Notes",
  href: "/modules/notes",
  version: "v1.0.0",
  status: "online",
  description: "Простые заметки пользователей",
  iconName: "StickyNote",
  requiredRoles: ["ADMIN", "EDITOR", "VIEWER"],
  healthEndpoint: "/api/modules/notes/health",
  navItems: [
    {
      id: "nav-notes-main",
      title: "Мои заметки",
      href: "/modules/notes",
      keywords: ["notes", "заметки"],
      iconName: "StickyNote"
    }
  ]
}

// 2. src/lib/auth/permissions-registry.ts — добавить разрешения
{ code: "notes.read", module: "notes", moduleName: "Notes", section: "notes", sectionName: "Заметки", action: "READ", name: "Просмотр заметок", description: "..." },
{ code: "notes.create", module: "notes", moduleName: "Notes", section: "notes", sectionName: "Заметки", action: "CREATE", name: "Создание заметок", description: "..." }

// 3. prisma/schema.prisma — добавить модель
model Note {
  id        String   @id @default(cuid())
  title     String
  content   String
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// 4. src/app/api/modules/notes/route.ts — API
// 5. src/app/modules/notes/page.tsx — UI
```

---

## 12. Чеклист перед мержем

```
□ Модуль зарегистрирован в MODULES_CONFIG
□ Разрешения добавлены в permissions-registry
□ Prisma миграция создана и применена
□ API routes реализованы с валидацией и RBAC
□ Health-check эндпоинт работает
□ Страницы модуля созданы
□ UI-slots зарегистрированы (если нужны)
□ Тесты написаны и проходят
□ Audit log вызывается для значимых операций
□ События публикуются через ShellEventBus
□ Документация обновлена
□ Нет хардкода чувствительных данных
□ Нет прямых SQL-запросов (используется Prisma)
□ Все входные данные валидируются через Zod
```
