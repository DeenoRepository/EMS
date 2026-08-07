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
import {
  PageHeader,
  KpiGrid,
  Modal,
  ModalHeader,
  FilterToolbar,
  DataTable,
  StatusBadge,
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
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Column visibility state with localStorage persistence (hydrated in useEffect to prevent SSR mismatch)
  const [columns, setColumns] = useState<ColumnVisibility>(DEFAULT_COLUMNS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("eps_registry_columns");
      if (saved) {
        setColumns({ ...DEFAULT_COLUMNS, ...JSON.parse(saved) });
      }
    } catch {
      // Игнорируем
    }
  }, []);

  const toggleColumn = (key: keyof ColumnVisibility) => {
    setColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("eps_registry_columns", JSON.stringify(updated));
      } catch {
        // Игнорируем
      }
      return updated;
    });
  };

  useEffect(() => {
    let isSubscribed = true;
    fetch(`/api/modules/eps/equipment?query=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (isSubscribed) setItems(data.items || []);
      })
      .catch(() => {})
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [query]);

  const fetchItems = () => {
    setLoading(true);
    fetch(`/api/modules/eps/equipment?query=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

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
        cell: (item: EquipmentItem) => (
          <div className="font-mono">
            <span className="block text-[11px] font-bold text-[#3473d4]">{item.equipmentCode}</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">{item.inventoryNumber}</span>
          </div>
        ),
      });
    }

    if (columns.name) {
      cols.push({
        key: "name",
        header: "Наименование",
        cell: (item: EquipmentItem) => (
          <div>
            <span className="block text-[11px] font-semibold text-[#17243a] dark:text-slate-200">{item.name}</span>
            <span className="block text-[10px] text-slate-400">Модель: {item.model}</span>
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
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <Tag size={12} className="text-slate-400" />
              <span>{item.category}</span>
            </div>
            <span className="block text-[10px] text-slate-400">{item.type}</span>
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
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <Building2 size={12} className="text-slate-400" />
              <span>{item.department}</span>
            </div>
            <span className="block text-[10px] text-slate-400">{item.location}</span>
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
        className: "text-right",
        cell: (item: EquipmentItem) => (
          <div className="flex items-center justify-end">
            <Link
              href={`/modules/eps/${item.id}`}
              className="text-[10px] font-semibold text-[#3473d4] hover:text-blue-700"
            >
              Открыть <ChevronRight size={11} className="inline" />
            </Link>
          </div>
        ),
      });
    }

    return cols;
  }, [columns]);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Реестр оборудования EPS"
          description={`Централизованный корпоративный учет единиц производственного оборудования (найдено ${filteredItems.length} из ${items.length} ед.).`}
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "EPS Паспортизация" },
          ]}
          actions={
            <>
              <a
                href="/api/modules/eps/equipment/export"
                download
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <Download size={13} /> Экспорт CSV
              </a>
              <button
                onClick={fetchItems}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Plus size={14} /> Создать паспорт
              </button>
            </>
          }
        />

        {/* Quick KPI Summary Cards */}
        <KpiGrid
          items={[
            {
              label: "Всего единиц",
              value: kpiStats.total,
              icon: <Layers size={14} />,
              iconColor: "blue",
              sub: "Паспортизировано в системе",
            },
            {
              label: "В эксплуатации",
              value: kpiStats.active,
              icon: <CheckCircle2 size={14} />,
              iconColor: "emerald",
              sub: `${kpiStats.activeRate}% от общего парка`,
              subColor: "emerald",
            },
            {
              label: "В резерве / Черновик",
              value: kpiStats.reserve,
              icon: <AlertCircle size={14} />,
              iconColor: "amber",
              sub: "Готовится к вводу",
            },
            {
              label: "Списано / Выведено",
              value: kpiStats.decommissioned,
              icon: <Archive size={14} />,
              iconColor: "slate",
              sub: "В архиве",
            },
          ]}
        />

        {/* Modal Create Equipment Passport */}
        <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
          <ModalHeader
            icon={<Server size={16} />}
            title="Создание нового паспорта оборудования"
            subtitle="Внесите технические параметры единицы оборудования"
            onClose={() => setShowCreateModal(false)}
          />
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
                  fetchItems();
                } else {
                  const err = await res.json();
                  alert(err.error || "Ошибка создания паспорта");
                }
              } catch {
                alert("Ошибка создания паспорта");
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
            } catch {}
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
          emptyText="Оборудование по заданным критериям фильтрации не найдено."
        />
      </main>
    </ShellLayout>
  );
}
