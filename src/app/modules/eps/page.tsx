"use client";

import { useState, useEffect, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { EquipmentItem } from "@/lib/modules/eps-store";
import {
  Server,
  Plus,
  RefreshCw,
  Download,
  Building2,
  Tag,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Archive,
  Layers,
} from "lucide-react";
import Link from "next/link";
import EquipmentPassportForm from "@/components/eps/equipment-passport-form";
import { useShell } from "@/components/layout/shell-context";
import {
  PageHeader,
  KpiGrid,
  Modal,
  FilterToolbar,
  DataTable,
  StatusBadge,
  Button,
  useToast,
} from "@/components/ui";

export interface ColumnVisibility {
  code: boolean;
  name: boolean;
  category: boolean;
  department: boolean;
  status: boolean;
  actions: boolean;
}

const DEFAULT_COLUMNS: ColumnVisibility = {
  code: true,
  name: true,
  category: true,
  department: true,
  status: true,
  actions: true,
};

export default function EpsEquipmentPage() {
  return (
    <ShellLayout>
      <EpsEquipmentPageContent />
    </ShellLayout>
  );
}

function EpsEquipmentPageContent() {
  const { currentUser } = useShell();
  const { success, error: showError } = useToast();
  const userRoles = currentUser?.roles || [];
  const canEdit = userRoles.includes("ADMIN") || userRoles.includes("EDITOR") || userRoles.includes("APPROVER");

  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [columns, setColumns] = useState<ColumnVisibility>(DEFAULT_COLUMNS);

  useEffect(() => {
    let isSubscribed = true;
    Promise.resolve().then(() => {
      if (!isSubscribed) return;
      try {
        const saved = localStorage.getItem("eps_registry_columns");
        if (saved) {
          setColumns({ ...DEFAULT_COLUMNS, ...JSON.parse(saved) });
        }
      } catch {
        // Ignore
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, []);

  const toggleColumn = (key: keyof ColumnVisibility) => {
    setColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("eps_registry_columns", JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const fetchItems = () => {
    setLoading(true);
    fetch(`/api/modules/eps/equipment?query=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setItems(data.items || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let isSubscribed = true;
    fetch(`/api/modules/eps/equipment?query=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (isSubscribed) setItems(data.items || []);
      })
      .catch(() => { })
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [query]);

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.category))).filter(Boolean);
  }, [items]);

  const departments = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.department))).filter(Boolean);
  }, [items]);

  const types = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.type))).filter(Boolean);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (departmentFilter !== "ALL" && item.department !== departmentFilter) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      return true;
    });
  }, [items, statusFilter, departmentFilter, categoryFilter, typeFilter]);

  const kpiStats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.status === "ACTIVE").length;
    const reserve = items.filter((i) => i.status === "INACTIVE" || i.status === "DRAFT").length;
    const decommissioned = items.filter((i) => i.status === "DECOMMISSIONED").length;
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, active, reserve, decommissioned, activeRate };
  }, [items]);

  const resetAllFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
    setDepartmentFilter("ALL");
    setCategoryFilter("ALL");
    setTypeFilter("ALL");
  };

  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (query) {
      chips.push({ id: "query", label: `Поиск: "${query}"`, onRemove: () => setQuery("") });
    }
    if (statusFilter !== "ALL") {
      chips.push({ id: "status", label: `Статус: ${statusFilter}`, onRemove: () => setStatusFilter("ALL") });
    }
    if (departmentFilter !== "ALL") {
      chips.push({ id: "dept", label: `Цех: ${departmentFilter}`, onRemove: () => setDepartmentFilter("ALL") });
    }
    if (categoryFilter !== "ALL") {
      chips.push({ id: "cat", label: `Категория: ${categoryFilter}`, onRemove: () => setCategoryFilter("ALL") });
    }
    if (typeFilter !== "ALL") {
      chips.push({ id: "type", label: `Тип: ${typeFilter}`, onRemove: () => setTypeFilter("ALL") });
    }
    return chips;
  }, [query, statusFilter, departmentFilter, categoryFilter, typeFilter]);

  // Dynamic table columns configuration
  const tableColumns = useMemo(() => {
    const cols = [];

    if (columns.code) {
      cols.push({
        key: "code",
        header: "Код / Инв. №",
        sortable: true,
        cell: (item: EquipmentItem) => (
          <div className="font-mono">
            <span className="block text-sm font-bold text-primary">{item.equipmentCode}</span>
            <span className="block text-xs text-muted-foreground mt-0.5">{item.inventoryNumber}</span>
          </div>
        ),
      });
    }

    if (columns.name) {
      cols.push({
        key: "name",
        header: "Наименование",
        sortable: true,
        cell: (item: EquipmentItem) => (
          <div>
            <span className="block text-sm font-semibold text-foreground">{item.name}</span>
            <span className="block text-xs text-muted-foreground">Модель: {item.model}</span>
          </div>
        ),
      });
    }

    if (columns.category) {
      cols.push({
        key: "category",
        header: "Категория & Тип",
        cell: (item: EquipmentItem) => (
          <div>
            <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span>{item.category}</span>
            </div>
            <span className="block text-xs text-muted-foreground">{item.type}</span>
          </div>
        ),
      });
    }

    if (columns.department) {
      cols.push({
        key: "department",
        header: "Подразделение / Позиция",
        cell: (item: EquipmentItem) => (
          <div>
            <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span>{item.department}</span>
            </div>
            <span className="block text-xs text-muted-foreground">{item.location}</span>
          </div>
        ),
      });
    }

    if (columns.status) {
      cols.push({
        key: "status",
        header: "Статус",
        cell: (item: EquipmentItem) => <StatusBadge status={item.status} />,
      });
    }

    if (columns.actions) {
      cols.push({
        key: "actions",
        header: "Действие",
        align: "right" as const,
        cell: (item: EquipmentItem) => (
          <Link
            href={`/modules/eps/${item.id}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Открыть <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ),
      });
    }

    return cols;
  }, [columns]);

  return (
    <div className="w-full px-4 py-6 md:px-8 space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Реестр оборудования EPS"
        description={`Централизованный корпоративный учет единиц производственного оборудования (найдено ${filteredItems.length} из ${items.length} ед.).`}
        breadcrumbs={[
          { title: "Главная", href: "/" },
          { title: "EPS Паспортизация" },
        ]}
        icon={<Server className="h-5 w-5" aria-hidden="true" />}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href="/api/modules/eps/equipment/export" download>
                <Download className="h-4 w-4" aria-hidden="true" />
                Экспорт CSV
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchItems}
              disabled={loading}
              loading={loading}
              loadingText="Обновление..."
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Обновить
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Создать паспорт
              </Button>
            )}
          </>
        }
      />

      {/* Quick KPI Summary Cards */}
      <KpiGrid
        items={[
          {
            label: "Всего единиц",
            value: kpiStats.total,
            icon: <Layers className="h-4 w-4" aria-hidden="true" />,
            iconColor: "blue",
            sub: "Паспортизировано в системе",
          },
          {
            label: "В эксплуатации",
            value: kpiStats.active,
            icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
            iconColor: "emerald",
            sub: `${kpiStats.activeRate}% от общего парка`,
            subColor: "emerald",
          },
          {
            label: "В резерве / Черновик",
            value: kpiStats.reserve,
            icon: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
            iconColor: "amber",
            sub: "Готовится к вводу",
          },
          {
            label: "Списано / Выведено",
            value: kpiStats.decommissioned,
            icon: <Archive className="h-4 w-4" aria-hidden="true" />,
            iconColor: "slate",
            sub: "В архиве",
          },
        ]}
      />

      {/* Modal Create Equipment Passport */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        size="lg"
        title="Создание нового паспорта оборудования"
        description="Внесите технические параметры единицы оборудования"
      >
        <EquipmentPassportForm
          onSubmit={async (formData) => {
            setCreating(true);
            try {
              const res = await fetch("/api/modules/eps/equipment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
              });

              if (res.ok) {
                setShowCreateModal(false);
                success("Паспорт создан", "Новая запись успешно добавлена в реестр");
                fetchItems();
              } else {
                const err = await res.json();
                showError("Ошибка создания", err.error || "Не удалось создать паспорт");
              }
            } catch {
              showError("Ошибка создания", "Произошла непредвиденная ошибка");
            } finally {
              setCreating(false);
            }
          }}
          onCancel={() => setShowCreateModal(false)}
          submitting={creating}
        />
      </Modal>

      {/* Enhanced Filter Toolbar & Column Selector */}
      <FilterToolbar
        searchQuery={query}
        onSearchChange={setQuery}
        searchPlaceholder="Поиск по названию, коду или инвентарному номеру…"
        filters={[
          {
            key: "status",
            label: "Статус",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "ALL", label: "Все статусы" },
              { value: "ACTIVE", label: "ACTIVE (В эксплуатации)" },
              { value: "INACTIVE", label: "INACTIVE (В резерве)" },
              { value: "DRAFT", label: "DRAFT (Черновик)" },
              { value: "DECOMMISSIONED", label: "DECOMMISSIONED (Списано)" },
            ],
          },
          {
            key: "department",
            label: "Подразделение",
            value: departmentFilter,
            onChange: setDepartmentFilter,
            options: [
              { value: "ALL", label: "Все цеха" },
              ...departments.map((dept) => ({ value: dept, label: dept })),
            ],
          },
          {
            key: "category",
            label: "Категория",
            value: categoryFilter,
            onChange: setCategoryFilter,
            options: [
              { value: "ALL", label: "Все категории" },
              ...categories.map((cat) => ({ value: cat, label: cat })),
            ],
          },
          {
            key: "type",
            label: "Тип техники",
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: "ALL", label: "Все типы техники" },
              ...types.map((tp) => ({ value: tp, label: tp })),
            ],
          },
        ]}
        columns={[
          { key: "code", label: "Код / Инв. №", visible: columns.code },
          { key: "name", label: "Наименование & Модель", visible: columns.name },
          { key: "category", label: "Категория & Тип", visible: columns.category },
          { key: "department", label: "Подразделение / Позиция", visible: columns.department },
          { key: "status", label: "Статус", visible: columns.status },
        ]}
        onColumnToggle={(key) => toggleColumn(key as keyof ColumnVisibility)}
        onColumnReset={() => {
          setColumns(DEFAULT_COLUMNS);
          try {
            localStorage.removeItem("eps_registry_columns");
          } catch { }
        }}
        activeChips={activeChips}
        onResetAll={resetAllFilters}
      />

      {/* Equipment Registry Data Table */}
      <DataTable
        columns={tableColumns}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        loading={loading}
        emptyText="Оборудование не найдено"
        emptyDescription="Попробуйте изменить параметры фильтрации или создайте новый паспорт"
        emptyVariant="no-data"
      />
    </div>
  );
}
