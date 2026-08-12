# UI Conventions

> **Версия:** 2.3.7  
> **Расположение кода:** [`src/components/`](../../src/components/), [`src/app/`](../../src/app/)

---

## 1. Обзор

UI в EMS построен на:
- **Next.js App Router** (React Server Components + Client Components)
- **Tailwind CSS** для стилизации
- **CVA (Class Variance Authority)** для вариантов компонентов
- **lucide-react** для иконок
- **Кастомный UI Kit** из 30+ компонентов

---

## 2. Структура компонентов

### 2.1. Организация

```
src/components/
├── layout/           # Shell layout (sidebar, topbar, breadcrumbs)
│   ├── shell-layout.tsx
│   ├── app-sidebar.tsx
│   ├── top-bar.tsx
│   ├── breadcrumbs.tsx
│   ├── global-search-modal.tsx
│   ├── shell-context.tsx
│   ├── module-status-badge.tsx
│   ├── module-error-fallback.tsx
│   └── ui-slot-host.tsx
├── ui/               # UI Kit (переиспользуемые компоненты)
│   ├── button.tsx
│   ├── card.tsx
│   ├── modal.tsx
│   ├── data-table.tsx
│   └── ...
├── eps/              # EPS-специфичные компоненты
│   └── equipment-passport-form.tsx
├── wms/              # WMS-специфичные компоненты
│   ├── catalog/
│   └── modals/
└── admin/            # Админ-компоненты
    └── role-constructor-modal.tsx
```

### 2.2. Server vs Client Components

**Server Components (по умолчанию):**
- Статический контент
- Чтение из БД (через API)
- SEO-критичные страницы

**Client Components (`"use client"`):**
- Интерактивные элементы (формы, кнопки)
- Использование hooks (useState, useEffect)
- Browser API (localStorage, fetch)

**Пример:**
```typescript
// Server Component (по умолчанию)
// src/app/modules/eps/page.tsx
import { prisma } from "@/lib/db/prisma";

export default async function EpsPage() {
  const equipment = await prisma.equipment.findMany();
  return <EquipmentList items={equipment} />;
}
```

```typescript
// Client Component
// src/components/eps/equipment-list.tsx
"use client";

import { useState } from "react";

export function EquipmentList({ items }: { items: Equipment[] }) {
  const [filter, setFilter] = useState("");
  // ...
}
```

---

## 3. Layout

### 3.1. Shell Layout

Все страницы модулей оборачиваются в [`ShellLayout`](../../src/components/layout/shell-layout.tsx):

```typescript
import ShellLayout from "@/components/layout/shell-layout";

export default function MyPage() {
  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8">
        {/* Контент */}
      </main>
    </ShellLayout>
  );
}
```

### 3.2. Структура страницы

```typescript
<ShellLayout>
  <main className="w-full px-5 py-6 md:px-8">
    {/* Header */}
    <PageHeader
      title="Заголовок страницы"
      description="Описание"
      actions={
        <Button onClick={handleCreate}>
          <Plus size={14} /> Создать
        </Button>
      }
    />
    
    {/* Filters */}
    <FilterToolbar>
      <SearchInput value={search} onChange={setSearch} />
      <Select value={status} onChange={setStatus} options={...} />
    </FilterToolbar>
    
    {/* Content */}
    <DataTable
      data={items}
      columns={columns}
      loading={loading}
    />
    
    {/* Pagination */}
    <Pagination
      total={total}
      limit={limit}
      offset={offset}
      onChange={handlePageChange}
    />
  </main>
</ShellLayout>
```

---

## 4. UI Kit

### 4.1. Список компонентов

| Компонент | Назначение |
|-----------|-----------|
| [`Button`](../../src/components/ui/button.tsx) | Кнопки с вариантами |
| [`Card`](../../src/components/ui/card.tsx) | Карточки контента |
| [`Modal`](../../src/components/ui/modal.tsx) | Модальные окна |
| [`DataTable`](../../src/components/ui/data-table.tsx) | Таблицы с данными |
| [`FormField`](../../src/components/ui/form-field.tsx) | Поля формы |
| [`FormSection`](../../src/components/ui/form-section.tsx) | Секции формы |
| [`Input`](../../src/components/ui/input.tsx) | Текстовые поля |
| [`Textarea`](../../src/components/ui/textarea.tsx) | Многострочные поля |
| [`Select`](../../src/components/ui/select.tsx) | Выпадающие списки |
| [`SearchableSelect`](../../src/components/ui/searchable-select.tsx) | Поиск + выбор |
| [`AutocompleteInput`](../../src/components/ui/autocomplete-input.tsx) | Автодополнение |
| [`Checkbox`](../../src/components/ui/checkbox.tsx) | Чекбоксы |
| [`Switch`](../../src/components/ui/switch.tsx) | Переключатели |
| [`Badge`](../../src/components/ui/badge.tsx) | Бейджи |
| [`StatusBadge`](../../src/components/ui/status-badge.tsx) | Статусы |
| [`FilterChip`](../../src/components/ui/filter-chip.tsx) | Чипы фильтров |
| [`FilterToolbar`](../../src/components/ui/filter-toolbar.tsx) | Тулбар фильтров |
| [`SearchInput`](../../src/components/ui/search-input.tsx) | Поиск |
| [`Pagination`](../../src/components/ui/pagination.tsx) | Пагинация |
| [`ColumnToggle`](../../src/components/ui/column-toggle.tsx) | Переключение колонок |
| [`ConfirmModal`](../../src/components/ui/confirm-modal.tsx) | Подтверждение |
| [`DocumentViewerModal`](../../src/components/ui/document-viewer-modal.tsx) | Просмотр документов |
| [`KeyValueEditor`](../../src/components/ui/key-value-editor.tsx) | Редактор пар ключ-значение |
| [`KpiCard`](../../src/components/ui/kpi-card.tsx) | KPI карточки |
| [`KpiGrid`](../../src/components/ui/kpi-grid.tsx) | Сетка KPI |
| [`MetricProgressCard`](../../src/components/ui/metric-progress-card.tsx) | Прогресс метрик |
| [`Timeline`](../../src/components/ui/timeline.tsx) | Временная шкала |
| [`StepperTimeline`](../../src/components/ui/stepper-timeline.tsx) | Степпер |
| [`TabNav`](../../src/components/ui/tab-nav.tsx) | Табы |
| [`UserChip`](../../src/components/ui/user-chip.tsx) | Чип пользователя |
| Charts | AreaChart, BarChart, DonutChart, StepChart |

### 4.2. Использование Button

```typescript
import { Button } from "@/components/ui/button";

// Варианты
<Button variant="primary">Основная</Button>
<Button variant="secondary">Вторичная</Button>
<Button variant="outline">Контурная</Button>
<Button variant="ghost">Прозрачная</Button>
<Button variant="destructive">Удалить</Button>

// Размеры
<Button size="sm">Маленькая</Button>
<Button size="md">Средняя</Button>
<Button size="lg">Большая</Button>

// С иконкой
<Button>
  <Plus size={14} className="mr-2" />
  Создать
</Button>

// Состояния
<Button disabled>Неактивна</Button>
<Button loading>Загрузка...</Button>
```

### 4.3. Использование DataTable

```typescript
import { DataTable } from "@/components/ui/data-table";

const columns = [
  { key: "name", label: "Название", sortable: true },
  { key: "status", label: "Статус", render: (item) => <StatusBadge status={item.status} /> },
  { key: "updatedAt", label: "Обновлено", render: (item) => formatDate(item.updatedAt) },
  {
    key: "actions",
    label: "",
    render: (item) => (
      <Button size="sm" onClick={() => handleEdit(item)}>Редактировать</Button>
    )
  }
];

<DataTable
  data={items}
  columns={columns}
  loading={loading}
  emptyMessage="Нет данных"
  onRowClick={handleRowClick}
/>
```

### 4.4. Использование Modal

```typescript
import { Modal } from "@/components/ui/modal";
import { ModalHeader } from "@/components/ui/modal-header";
import { ModalFooter } from "@/components/ui/modal-footer";

<Modal open={isOpen} onClose={() => setIsOpen(false)}>
  <ModalHeader title="Создание сущности" onClose={() => setIsOpen(false)} />
  
  <div className="p-6">
    {/* Содержимое модального окна */}
    <FormField label="Название">
      <Input value={name} onChange={(e) => setName(e.target.value)} />
    </FormField>
  </div>
  
  <ModalFooter>
    <Button variant="outline" onClick={() => setIsOpen(false)}>Отмена</Button>
    <Button onClick={handleSave}>Сохранить</Button>
  </ModalFooter>
</Modal>
```

---

## 5. Стилизация

### 5.1. Tailwind CSS

Используется utility-first подход:

```typescript
<div className="flex items-center justify-between gap-4 p-4 bg-white rounded-lg shadow-sm">
  <h2 className="text-lg font-semibold text-[#17243a]">Заголовок</h2>
  <Button>Действие</Button>
</div>
```

### 5.2. Цветовая палитра

```css
/* Основные цвета */
--primary: #3473d4;        /* Синий (бренд) */
--primary-hover: #2565c8;
--text-primary: #17243a;   /* Тёмно-синий */
--text-secondary: #64748b; /* Серый */
--bg-primary: #f6f8fb;     /* Светло-серый */
--bg-card: #ffffff;
--border: #e2e8f0;

/* Статусы */
--success: #10b981;
--warning: #f59e0b;
--danger: #ef4444;
--info: #3b82f6;
```

### 5.3. Dark Mode

Поддерживается через Tailwind:

```typescript
<div className="bg-white dark:bg-slate-950 text-[#17243a] dark:text-slate-100">
  {/* Контент */}
</div>
```

### 5.4. Responsive

Mobile-first подход:

```typescript
<div className="
  grid 
  grid-cols-1 
  md:grid-cols-2 
  lg:grid-cols-4 
  gap-3
">
  {/* Адаптивная сетка */}
</div>
```

### 5.5. Breakpoints

```css
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

---

## 6. Иконки

### 6.1. lucide-react

```typescript
import { Box, Server, Settings, Plus, Search } from "lucide-react";

<Button>
  <Plus size={14} className="mr-2" />
  Создать
</Button>
```

### 6.2. Размеры

- `size={12}` — маленькие (в тексте)
- `size={14}` — стандартные (в кнопках)
- `size={16}` — средние (в sidebar)
- `size={18}` — большие (в topbar)
- `size={20-24}` — очень большие (в hero)

### 6.3. Динамические иконки

Для sidebar используется динамическая загрузка:

```typescript
import * as Icons from "lucide-react";

function DynamicIcon({ name }: { name: string }) {
  const IconComp = (Icons as any)[name] || Icons.Box;
  return <IconComp size={14} />;
}
```

---

## 7. Формы

### 7.1. Структура

```typescript
"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function MyForm() {
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    description: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Отправка данных
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection title="Основная информация">
        <FormField label="Название" required>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </FormField>
        
        <FormField label="Тип">
          <Select
            value={formData.type}
            onChange={(value) => setFormData({ ...formData, type: value })}
            options={[
              { value: "type1", label: "Тип 1" },
              { value: "type2", label: "Тип 2" }
            ]}
          />
        </FormField>
        
        <FormField label="Описание">
          <Input
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </FormField>
      </FormSection>
      
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline">Отмена</Button>
        <Button type="submit">Сохранить</Button>
      </div>
    </form>
  );
}
```

### 7.2. Валидация

Использовать Zod + react-hook-form (рекомендуется) или ручную валидацию:

```typescript
const [errors, setErrors] = useState<Record<string, string>>({});

const validate = () => {
  const newErrors: Record<string, string> = {};
  if (!formData.name) newErrors.name = "Название обязательно";
  if (formData.name.length < 2) newErrors.name = "Минимум 2 символа";
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

---

## 8. Загрузка данных

### 8.1. Паттерн с useState + useEffect

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

export function MyList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/modules/mymodule/entities");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} onRetry={loadItems} />;
  return <DataTable data={items} columns={columns} />;
}
```

### 8.2. Кастомные хуки

Для переиспользуемой логики создавать хуки:

```typescript
// src/lib/hooks/use-entities.ts
export function useEntities() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // ... логика загрузки
  
  return { items, loading, refetch: loadItems };
}

// Использование
const { items, loading, refetch } = useEntities();
```

---

## 9. Обработка ошибок

### 9.1. Error Boundary

```typescript
// src/app/error.tsx
"use client";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-xl font-semibold">Что-то пошло не так</h2>
      <p className="text-slate-500 mt-2">{error.message}</p>
      <Button onClick={reset} className="mt-4">Попробовать снова</Button>
    </div>
  );
}
```

### 9.2. Module Error Fallback

```typescript
import { ModuleErrorFallback } from "@/components/layout/module-error-fallback";

<ModuleErrorFallback
  moduleName="EPS"
  error={error}
  onRetry={refetch}
/>
```

---

## 10. Accessibility (a11y)

### 10.1. Семантика

```typescript
// ✅ Правильно
<button onClick={handleClick}>Нажми</button>
<nav aria-label="Основная навигация">...</nav>
<main>...</main>

// ❌ Неправильно
<div onClick={handleClick}>Нажми</div>
```

### 10.2. ARIA атрибуты

```typescript
<button
  aria-label="Закрыть"
  aria-expanded={isOpen}
  aria-controls="menu"
>
  ...
</button>
```

### 10.3. Keyboard Navigation

```typescript
<div
  role="menuitem"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClick();
    }
  }}
>
  ...
</div>
```

### 10.4. Focus Management

```typescript
import { useRef, useEffect } from "react";

const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  inputRef.current?.focus();
}, []);
```

---

## 11. Анимации

### 11.1. CSS Transitions

```typescript
<div className="transition-all duration-300 ease-in-out hover:scale-105">
  {/* Контент */}
</div>
```

### 11.2. Tailwind Animate

```typescript
<div className="animate-in fade-in zoom-in-95 duration-150">
  {/* Появляющийся контент */}
</div>
```

### 11.3. Skeleton Loading

```typescript
<div className="animate-pulse">
  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
  <div className="h-4 bg-slate-200 rounded w-1/2 mt-2"></div>
</div>
```

---

## 12. Лучшие практики

✅ **Делать:**
- Использовать UI Kit компоненты вместо кастомных
- Следовать дизайн-системе (цвета, отступы, типографика)
- Делать компоненты переиспользуемыми
- Добавлять loading и error состояния
- Поддерживать keyboard navigation
- Использовать semantic HTML
- Тестировать на разных разрешениях

❌ **Не делать:**
- Не использовать inline styles (только Tailwind)
- Не хардкодить цвета (использовать палитру)
- Не игнорировать accessibility
- Не делать компоненты слишком большими (разбивать)
- Не использовать `dangerouslySetInnerHTML` без санитизации
- Не забывать про loading состояния

---

## 13. Чеклист для новой страницы

```
□ Использует ShellLayout
□ Имеет PageHeader с заголовком и описанием
□ Имеет FilterToolbar (если нужен поиск/фильтры)
□ Использует DataTable для списков
□ Имеет loading состояние
□ Имеет error состояние
□ Имеет empty state
□ Имеет пагинацию (если список)
□ Responsive (mobile, tablet, desktop)
□ Accessibility (ARIA, keyboard)
□ Темная тема поддерживается
□ Использует UI Kit компоненты
□ Логирует значимые действия
```
