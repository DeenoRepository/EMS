# RBAC System

> **Расположение кода:** [`src/lib/auth/`](../../src/lib/auth/), [`src/middleware.ts`](../../src/middleware.ts)

---

## 1. Обзор

EMS использует **двухуровневую систему авторизации**:

1. **Role-based** — проверка наличия роли у пользователя
2. **Permission-based** — проверка гранулярных разрешений
3. **Scope-based** — ограничение области действия (склады, подразделения)

**Принцип:** Deny by Default. Все операции требуют явной авторизации.

---

## 2. Архитектура RBAC

```
┌─────────────────────────────────────────────────────────────┐
│                    User Session (JWT)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  id, username, displayName, email                   │    │
│  │  roles: ["ADMIN", "EDITOR"]                         │    │
│  │  permissions: ["eps.equipment.read", ...]           │    │
│  │  scopes: { allowedWarehouses: [...], isGlobal }     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Authorization Checks                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  hasRole()   │  │hasPermission │  │  hasModuleAccess │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  UserRole    │  │ RolePerm     │  │   RoleScope      │   │
│  │  (M:N)       │  │  (M:N)       │  │ (1:1 per role)   │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Роли

### 3.1. Системные роли

| Роль | Описание | Доступ |
|------|----------|--------|
| `ADMIN` | Администратор системы | Полный доступ ко всем модулям |
| `EDITOR` | Редактор EPS | Создание/редактирование оборудования |
| `APPROVER` | Согласующий | Утверждение заявок, экспорт отчётов |
| `VIEWER` | Наблюдатель | Только чтение |
| `STOREKEEPER` | Кладовщик WMS | Управление складом |
| `eps_engineer` | Инженер EPS | Работа с оборудованием |
| `eps_approver` | Согласующий EPS | Утверждение паспортов |
| `wms_storekeeper` | Кладовщик WMS | Складские операции |
| `viewer_readonly` | Только чтение | Минимальный доступ |

### 3.2. Кастомные роли

Создаются через админ-панель (`/admin/rbac`). Хранятся в таблице `Role` с `isSystem = false`.

---

## 4. Разрешения (Permissions)

### 4.1. Структура

```typescript
interface PermissionDefinition {
  code: string;           // "eps.equipment.read"
  module: string;         // "eps"
  moduleName: string;     // "EPS Паспортизация"
  section: string;        // "equipment"
  sectionName: string;    // "Реестр оборудования"
  action: "READ" | "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "EXPORT" | "EXECUTE";
  name: string;           // "Просмотр оборудования"
  description: string;    // "Просмотр карточек оборудования..."
}
```

### 4.2. Соглашения об именовании

- Формат: `{module}.{section}.{action}`
- Примеры:
  - `eps.equipment.read`
  - `eps.equipment.create`
  - `wms.items.update`
  - `wms.movements.execute`
  - `admin.roles.manage`

### 4.3. Регистрация разрешений

Все разрешения регистрируются в [`src/lib/auth/permissions-registry.ts`](../../src/lib/auth/permissions-registry.ts):

```typescript
export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  {
    code: "mymodule.entities.read",
    module: "mymodule",
    moduleName: "My Module",
    section: "entities",
    sectionName: "Сущности",
    action: "READ",
    name: "Просмотр сущностей",
    description: "Просмотр списка и деталей сущностей"
  }
  // ...
];
```

---

## 5. Scope (Область действия)

### 5.1. Назначение

Scope ограничивает область действия роли. Например, кладовщик может работать только с определёнными складами.

### 5.2. Структура

```typescript
interface RoleScopeConfig {
  allowedWarehouses?: string[];   // ID или названия складов
  allowedDepartments?: string[];  // ID или названия подразделений
  isGlobal?: boolean;             // true = без ограничений
}
```

### 5.3. Модель БД

```prisma
model RoleScope {
  id                 String   @id @default(cuid())
  roleId             String   @unique
  allowedWarehouses  Json?    // ["warehouse-1", "warehouse-2"]
  allowedDepartments Json?    // ["dept-1", "dept-2"]
  isGlobal           Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
}
```

### 5.4. Использование в коде

```typescript
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";

export async function GET(request: Request) {
  const responsibleWarehouses = await getUserResponsibleWarehouses();
  
  // null = ADMIN (полный доступ)
  // [] = нет доступа к складам
  // ["warehouse-1", "warehouse-2"] = доступ только к этим складам
  
  const where: any = {};
  if (responsibleWarehouses !== null) {
    if (responsibleWarehouses.length === 0) {
      return NextResponse.json({ items: [], total: 0 });
    }
    where.warehouse = { in: responsibleWarehouses };
  }
  
  // ...
}
```

---

## 6. API для проверки прав

### 6.1. `hasRole(user, requiredRoles)`

Проверяет наличие хотя бы одной из требуемых ролей.

```typescript
import { hasRole } from "@/lib/auth/rbac";

if (hasRole(session, ["ADMIN", "EDITOR"])) {
  // Доступ разрешён
}
```

**Особенности:**
- `ADMIN` автоматически проходит любую проверку
- Если `user === null` → возвращает `false`

### 6.2. `hasPermission(user, permissionCode)`

Проверяет наличие конкретного разрешения.

```typescript
import { hasPermission } from "@/lib/auth/rbac";

if (hasPermission(session, "eps.equipment.create")) {
  // Доступ к созданию оборудования
}
```

**Особенности:**
- `ADMIN` или `permissions: ["*"]` → всегда `true`
- Проверяет массив `permissions` в сессии

### 6.3. `hasModuleAccess(user, moduleId)`

Проверяет доступ к модулю целиком.

```typescript
import { hasModuleAccess } from "@/lib/auth/rbac";

if (hasModuleAccess(session, "eps")) {
  // Доступ к модулю EPS
}
```

**Логика:**
1. `ADMIN` или `permissions: ["*"]` → `true`
2. Есть разрешения с префиксом `{moduleId}.` → `true`
3. Есть требуемая роль из `manifest.requiredRoles` → `true`
4. Иначе → `false`

---

## 7. Guards (Защитники API)

### 7.1. `requireSession()`

Проверяет наличие валидной сессии.

```typescript
import { requireSession } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.authorized) {
    return auth.response; // 401 Unauthorized
  }
  
  const { session } = auth;
  // ... логика
}
```

### 7.2. `requireRole(session, allowedRoles)`

Проверяет наличие требуемой роли.

```typescript
import { requireSession, requireRole } from "@/lib/auth/guards";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.authorized) return auth.response;
  
  const roleCheck = requireRole(auth.session, ["ADMIN", "EDITOR"]);
  if (!roleCheck.authorized) return roleCheck.response; // 403 Forbidden
  
  // ... логика
}
```

### 7.3. `requireAdmin(session)`

Сокращение для `requireRole(session, ["ADMIN"])`.

### 7.4. `requireModulePermission(session, moduleId)`

Проверяет доступ к модулю.

```typescript
import { requireSession, requireModulePermission } from "@/lib/auth/guards";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.authorized) return auth.response;
  
  const moduleCheck = requireModulePermission(auth.session, "eps");
  if (!moduleCheck.authorized) return moduleCheck.response; // 403 Forbidden
  
  // ... логика
}
```

---

## 8. Middleware ([`src/middleware.ts`](../../src/middleware.ts))

Middleware выполняет базовую проверку на Edge Runtime:

```typescript
// 1. Публичные пути — пропускаем
if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
  return NextResponse.next();
}

// 2. Проверка JWT
const token = request.cookies.get("ems_session")?.value;
if (!token) {
  // 401 для API, redirect на /login для страниц
}

// 3. Верификация токена
const session = await verifySessionToken(token);
if (!session) {
  // 401 / redirect
}

// 4. RBAC для /admin/*
if (pathname.startsWith("/admin") && !hasRole(session, ["ADMIN"])) {
  return NextResponse.redirect(new URL("/modules", request.url));
}

// 5. RBAC для /api/admin/*
if (pathname.startsWith("/api/admin") && !hasRole(session, ["ADMIN"])) {
  return NextResponse.json({ error: "..." }, { status: 403 });
}

// 6. Проверка доступа к модулю
const moduleMatch = pathname.match(/^\/modules\/([^/]+)/);
if (moduleMatch) {
  const moduleId = moduleMatch[1];
  if (MODULES_CONFIG[moduleId] && !hasModuleAccess(session, moduleId)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
}
```

---

## 9. Авторизация в API Routes

### 9.1. Стандартный паттерн

```typescript
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

  // 3. Валидация входных данных
  const body = await request.json();
  const validation = createSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: "..." }, { status: 400 });
  }

  // 4. Бизнес-логика
  // ...
}
```

### 9.2. С использованием Guards

```typescript
export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.authorized) return auth.response;

  const roleCheck = requireRole(auth.session, ["ADMIN", "EDITOR"]);
  if (!roleCheck.authorized) return roleCheck.response;

  // ... логика
}
```

---

## 10. Scope-based фильтрация (WMS)

### 10.1. Получение доступных складов

```typescript
import { getUserResponsibleWarehouses } from "@/lib/auth/wms-rbac";

const warehouses = await getUserResponsibleWarehouses();
// null = ADMIN (все склады)
// [] = нет доступа
// ["warehouse-1"] = только эти склады
```

### 10.2. Применение в запросах

```typescript
const where: any = {};

if (responsibleWarehouses !== null) {
  if (responsibleWarehouses.length === 0) {
    return NextResponse.json({ items: [], total: 0 });
  }
  where.OR = [
    { warehouse: { in: responsibleWarehouses } },
    { warehouseId: { in: responsibleWarehouses } }
  ];
}
```

### 10.3. Проверка при записи

```typescript
if (responsibleWarehouses !== null && !responsibleWarehouses.includes(body.warehouse)) {
  return NextResponse.json(
    { error: `Доступ запрещен. Вы ответственны только за: ${responsibleWarehouses.join(", ")}` },
    { status: 403 }
  );
}
```

---

## 11. Матрица авторизации ([`authorization-matrix.ts`](../../src/lib/auth/authorization-matrix.ts))

Декларативное описание прав доступа к API endpoints:

```typescript
export const AUTHORIZATION_MATRIX: EndpointPolicy[] = [
  {
    path: "/api/reference/fields",
    method: "GET",
    allowedRoles: ["ADMIN", "EDITOR", "APPROVER", "STOREKEEPER", "VIEWER"],
    description: "Просмотр справочных полей"
  },
  {
    path: "/api/admin/warehouses",
    method: "POST",
    allowedRoles: ["ADMIN"],
    description: "Управление складами"
  }
  // ...
];
```

**Примечание:** В текущей реализации матрица используется для документации. Фактическая проверка выполняется через guards в каждом route.

---

## 12. Создание кастомных ролей

### 12.1. Через админ-панель

1. Перейти в `/admin/rbac`
2. Нажать "Создать роль"
3. Указать:
   - `key` — уникальный идентификатор (например, `wms_operator_nsk`)
   - `name` — отображаемое название
   - `description` — описание
   - `permissions` — массив разрешений
   - `scope` — область действия (склады, подразделения)

### 12.2. Через БД

```typescript
const role = await prisma.role.create({
  data: {
    key: "wms_operator_nsk",
    name: "Оператор WMS (Новосибирск)",
    description: "Оператор склада в Новосибирске",
    isSystem: false,
    permissions: {
      create: [
        { permission: { connect: { code: "wms.items.read" } } },
        { permission: { connect: { code: "wms.movements.execute" } } }
      ]
    },
    scope: {
      create: {
        allowedWarehouses: ["warehouse-nsk-1", "warehouse-nsk-2"],
        isGlobal: false
      }
    }
  }
});
```

---

## 13. Лучшие практики

✅ **Делать:**
- Использовать `hasPermission()` для гранулярных проверок
- Использовать `hasRole()` только для высокоуровневых проверок
- Применять scope-фильтрацию для WMS-операций
- Логировать отказы в доступе через `logEvent()`
- Документировать разрешения в `permissions-registry.ts`

❌ **Не делать:**
- Не проверять роли/разрешения только в UI (всегда дублировать в API)
- Не хардкодить роли в коде (использовать константы)
- Не давать `ADMIN` без необходимости
- Не игнорировать scope при работе с WMS
- Не создавать разрешения без описания

---

## 14. Миграция с MOCK_USERS

В dev-режиме используются mock-пользователи из [`src/lib/auth/rbac.ts`](../../src/lib/auth/rbac.ts:21). Для production:

1. Создать seed-скрипт для начальных пользователей
2. Настроить LDAP/AD через `LDAP_URL` и `LDAP_BASE_DN`
3. Удалить или обусловить `MOCK_USERS` через `NODE_ENV`
4. Настроить `JWT_SECRET` (минимум 32 байта)
