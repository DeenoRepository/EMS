"use client";

import { useState, useEffect, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { useShell } from "@/components/layout/shell-context";
import { WmsItem, WmsMovement, filterWmsItems } from "@/lib/modules/wms-store";
import { useItemSelection } from "@/lib/hooks/use-item-selection";
import {
  Plus,
  RefreshCw,
  Download,
  Building2,
  ChevronRight,
  Box,
  PackageCheck,
  DollarSign,
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import WmsItemForm from "@/components/wms/wms-item-form";
import WmsOperationModal from "@/components/wms/wms-operation-modal";
import WmsTransferRequestModal from "@/components/wms/wms-transfer-request-modal";
import WmsSubNav from "@/components/wms/wms-sub-nav";
import {
  PageHeader,
  KpiGrid,
  FilterToolbar,
  DataTable,
  StatusBadge,
  Checkbox,
} from "@/components/ui";

export interface WmsColumnVisibility {
  sku: boolean;
  name: boolean;
  category: boolean;
  warehouse: boolean;
  cell: boolean;
  quantity: boolean;
  unitPrice: boolean;
  status: boolean;
  actions: boolean;
}

const DEFAULT_WMS_COLUMNS: WmsColumnVisibility = {
  sku: true,
  name: true,
  category: true,
  warehouse: true,
  cell: true,
  quantity: true,
  unitPrice: true,
  status: true,
  actions: true,
};

function WmsRegistryContent() {
  const { currentUser } = useShell();

  const [items, setItems] = useState<WmsItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showOpModal, setShowOpModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [opModalDefaultType, setOpModalDefaultType] = useState<WmsMovement["type"]>("INCOMING");
  const [opModalSelectedItems, setOpModalSelectedItems] = useState<WmsItem[]>([]);

  // Column visibility state with localStorage persistence
  const [columns, setColumns] = useState<WmsColumnVisibility>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("wms_registry_columns") : null;
      if (saved) {
        return { ...DEFAULT_WMS_COLUMNS, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore
    }
    return DEFAULT_WMS_COLUMNS;
  });

  const toggleColumn = (key: keyof WmsColumnVisibility) => {
    setColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("wms_registry_columns", JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  useEffect(() => {
    let isSubscribed = true;
    fetch(`/api/modules/wms/items?query=${encodeURIComponent(query)}`)
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
    fetch(`/api/modules/wms/items?query=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.category))).filter(Boolean);
  }, [items]);

  const warehouses = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.warehouse))).filter(Boolean);
  }, [items]);

  const types = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.type))).filter(Boolean);
  }, [items]);

  const filteredItems = useMemo(() => {
    const list = filterWmsItems(items, query);
    return list.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (warehouseFilter !== "ALL" && item.warehouse !== warehouseFilter) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      return true;
    });
  }, [items, query, statusFilter, warehouseFilter, categoryFilter, typeFilter]);

  const {
    selectedIds,
    toggleSelectAll,
    toggleSelectItem,
  } = useItemSelection(filteredItems);

  const openTransferModal = () => {
    const selectedItemsList = items.filter((i) => selectedIds.includes(i.id));
    setOpModalSelectedItems(selectedItemsList.length > 0 ? selectedItemsList : (items[0] ? [items[0]] : []));
    setShowTransferModal(true);
  };

  const openBulkOperation = (type: WmsMovement["type"]) => {
    const selectedItemsList = items.filter((i) => selectedIds.includes(i.id));
    setOpModalDefaultType(type);
    setOpModalSelectedItems(selectedItemsList.length > 0 ? selectedItemsList : (items[0] ? [items[0]] : []));
    setShowOpModal(true);
  };

  const kpiStats = useMemo(() => {
    const totalPos = items.length;
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
    const lowStock = items.filter((i) => i.status === "LOW_STOCK" || i.status === "OUT_OF_STOCK").length;
    const reserved = items.reduce((sum, i) => sum + i.reservedQuantity, 0);
    const totalValue = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    return { totalPos, totalQty, lowStock, reserved, totalValue };
  }, [items]);

  const resetAllFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
    setWarehouseFilter("ALL");
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
    if (warehouseFilter !== "ALL") {
      chips.push({ id: "wh", label: `Склад: ${warehouseFilter}`, onRemove: () => setWarehouseFilter("ALL") });
    }
    if (categoryFilter !== "ALL") {
      chips.push({ id: "cat", label: `Категория: ${categoryFilter}`, onRemove: () => setCategoryFilter("ALL") });
    }
    if (typeFilter !== "ALL") {
      chips.push({ id: "type", label: `Тип: ${typeFilter}`, onRemove: () => setTypeFilter("ALL") });
    }
    return chips;
  }, [query, statusFilter, warehouseFilter, categoryFilter, typeFilter]);

  const wmsColorMap = {
    IN_STOCK: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
    LOW_STOCK: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
    OUT_OF_STOCK: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
    OVERSTOCKED: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-400", dot: "bg-[#3473d4]" },
  };

  const wmsStatusLabels: Record<string, string> = {
    IN_STOCK: "В наличии",
    LOW_STOCK: "Дефицит / Мало",
    OUT_OF_STOCK: "Отсутствует",
    OVERSTOCKED: "Избыток",
  };

  const tableColumns = useMemo(() => {
    const cols = [
      {
        key: "select",
        header: (
          <Checkbox
            checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
            onChange={toggleSelectAll}
          />
        ),
        cell: (item: WmsItem) => (
          <Checkbox
            checked={selectedIds.includes(item.id)}
            onChange={() => toggleSelectItem(item.id)}
          />
        ),
      },
    ];

    if (columns.sku) {
      cols.push({
        key: "sku",
        header: "Артикул / SKU",
        cell: (item: WmsItem) => (
          <div className="font-mono">
            <span className="block text-[11px] font-bold text-[#3473d4]">{item.sku}</span>
            <span className="block text-[9px] text-slate-400 mt-0.5">{item.barcode || "Без штрихкода"}</span>
          </div>
        ),
      });
    }

    if (columns.name) {
      cols.push({
        key: "name",
        header: "Наименование ТМЦ / ЗИП",
        cell: (item: WmsItem) => (
          <div>
            <span className="block text-[11px] font-semibold text-[#17243a] dark:text-slate-200">{item.name}</span>
            {item.description && <span className="block text-[10px] text-slate-400 truncate max-w-xs">{item.description}</span>}
          </div>
        ),
      });
    }

    if (columns.category) {
      cols.push({
        key: "category",
        header: "Категория & Тип",
        cell: (item: WmsItem) => (
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

    if (columns.warehouse) {
      cols.push({
        key: "warehouse",
        header: "Склад & МОЛ",
        cell: (item: WmsItem) => (
          <div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <Building2 size={12} className="text-slate-400" />
              <span>{item.warehouse}</span>
            </div>
            <span className="block text-[10px] text-slate-400">МОЛ: {item.responsibleUser}</span>
          </div>
        ),
      });
    }

    if (columns.cell) {
      cols.push({
        key: "cell",
        header: "Ячейка",
        cell: (item: WmsItem) => <span className="font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-400">{item.cell || "—"}</span>,
      });
    }

    if (columns.quantity) {
      cols.push({
        key: "quantity",
        header: "Остаток / Зарезерв.",
        cell: (item: WmsItem) => (
          <div className="font-mono">
            <span className="block text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {item.quantity} {item.unit}
            </span>
            {item.reservedQuantity > 0 && (
              <span className="block text-[9px] text-amber-600 dark:text-amber-400 font-medium">Забронировано: {item.reservedQuantity}</span>
            )}
          </div>
        ),
      });
    }

    if (columns.unitPrice) {
      cols.push({
        key: "unitPrice",
        header: "Цена / Сумма",
        cell: (item: WmsItem) => (
          <div className="font-mono">
            <span className="block text-[11px] text-slate-700 dark:text-slate-300">{item.unitPrice.toLocaleString("ru-RU")} ₽</span>
            <span className="block text-[9px] text-slate-400">{(item.quantity * item.unitPrice).toLocaleString("ru-RU")} ₽</span>
          </div>
        ),
      });
    }

    if (columns.status) {
      cols.push({
        key: "status",
        header: "Статус",
        cell: (item: WmsItem) => (
          <StatusBadge status={item.status} label={wmsStatusLabels[item.status]} colorMap={wmsColorMap} />
        ),
      });
    }

    if (columns.actions) {
      cols.push({
        key: "actions",
        header: <span className="text-right block">Действия</span>,
        cell: (item: WmsItem) => (
          <div className="flex items-center justify-end">
            <Link href={`/modules/wms/items/${item.id}`} className="text-[10px] font-semibold text-[#3473d4] hover:text-blue-700">
              Открыть <ChevronRight size={11} className="inline" />
            </Link>
          </div>
        ),
      });
    }

    return cols;
  }, [columns, filteredItems, selectedIds, toggleSelectAll, toggleSelectItem]);

  return (
    <main className="w-full px-5 py-6 md:px-8 space-y-6">
      <PageHeader
        title="Реестр ТМЦ, ЗИП и Складских запасов"
        description={`Централизованный учёт номенклатуры, деталей и материалов (найдено ${filteredItems.length} из ${items.length} ед.).`}
        breadcrumbs={[
          { title: "Главная", href: "/" },
          { title: "WMS Складской учёт" },
        ]}
        actions={
          <>
            <a
              href="/api/modules/wms/items/export"
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
              <Plus size={14} /> Создать карточку ТМЦ
            </button>
          </>
        }
      />

      <WmsSubNav totalItemsCount={kpiStats.totalPos} lowStockCount={kpiStats.lowStock} />

      <KpiGrid
        items={[
          {
            label: "Позиций номенклатуры",
            value: kpiStats.totalPos,
            icon: <Box size={14} />,
            iconColor: "blue",
            sub: "Учитывается в реестре",
          },
          {
            label: "Всего единиц ТМЦ",
            value: kpiStats.totalQty.toLocaleString("ru-RU"),
            icon: <PackageCheck size={14} />,
            iconColor: "emerald",
            sub: "На всех складах enterprise",
            subColor: "emerald",
          },
          {
            label: "Дефицитные позиции",
            value: kpiStats.lowStock,
            icon: <Box size={14} />,
            iconColor: "amber",
            sub: "Ниже мин. порога остатка",
            subColor: "amber",
          },
          {
            label: "Оценочная стоимость",
            value: `${(kpiStats.totalValue / 1000000).toFixed(2)} млн ₽`,
            icon: <DollarSign size={14} />,
            iconColor: "indigo",
            sub: "Совокупный баланс ЗИП",
          },
        ]}
      />

      {/* Bulk actions bar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openBulkOperation("INCOMING")}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition"
          >
            <ArrowDownLeft size={13} /> Приход ТМЦ
          </button>
          <button
            type="button"
            onClick={() => openBulkOperation("OUTGOING")}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700 transition"
          >
            <ArrowUpRight size={13} /> Расход / Списание
          </button>
          <button
            type="button"
            onClick={openTransferModal}
            className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#2565c8] transition"
          >
            <RefreshCcw size={13} /> Перемещение
          </button>
        </div>
        {selectedIds.length > 0 && (
          <span className="text-[11px] font-semibold text-[#3473d4]">Выбрано позиций: {selectedIds.length}</span>
        )}
      </div>

      <FilterToolbar
        searchQuery={query}
        onSearchChange={setQuery}
        searchPlaceholder="Поиск по наименованию, SKU или штрихкоду…"
        filters={[
          {
            key: "status",
            label: "Статус",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "ALL", label: "Все статусы" },
              { value: "IN_STOCK", label: "В наличии" },
              { value: "LOW_STOCK", label: "Дефицит" },
              { value: "OUT_OF_STOCK", label: "Отсутствует" },
              { value: "OVERSTOCKED", label: "Избыток" },
            ],
          },
          {
            key: "warehouse",
            label: "Склад",
            value: warehouseFilter,
            onChange: setWarehouseFilter,
            options: [
              { value: "ALL", label: "Все склады" },
              ...warehouses.map((wh) => ({ value: wh, label: wh })),
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
            label: "Тип",
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: "ALL", label: "Все типы" },
              ...types.map((tp) => ({ value: tp, label: tp })),
            ],
          },
        ]}
        columns={[
          { key: "sku", label: "Артикул / SKU", visible: columns.sku },
          { key: "name", label: "Наименование ТМЦ / ЗИП", visible: columns.name },
          { key: "category", label: "Категория & Тип", visible: columns.category },
          { key: "warehouse", label: "Склад & МОЛ", visible: columns.warehouse },
          { key: "cell", label: "Ячейка", visible: columns.cell },
          { key: "quantity", label: "Остаток / Зарезерв.", visible: columns.quantity },
          { key: "unitPrice", label: "Цена / Сумма", visible: columns.unitPrice },
          { key: "status", label: "Статус", visible: columns.status },
        ]}
        onColumnToggle={(key) => toggleColumn(key as keyof WmsColumnVisibility)}
        onColumnReset={() => {
          setColumns(DEFAULT_WMS_COLUMNS);
          try {
            localStorage.removeItem("wms_registry_columns");
          } catch {}
        }}
        activeChips={activeChips}
        onResetAll={resetAllFilters}
      />

      <DataTable
        columns={tableColumns}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        loading={loading}
        emptyText="ТМЦ по заданным фильтрам не найдены."
      />

      <WmsItemForm
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmitSuccess={() => fetchItems()}
        existingItems={items}
      />

      <WmsOperationModal
        isOpen={showOpModal}
        onClose={() => setShowOpModal(false)}
        onSubmitSuccess={() => fetchItems()}
        items={items}
        selectedItems={opModalSelectedItems}
        allRegistryItems={items}
        defaultType={opModalDefaultType}
      />

      <WmsTransferRequestModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSubmitSuccess={() => fetchItems()}
        selectedItems={opModalSelectedItems}
        allRegistryItems={items}
        currentUser={currentUser}
      />
    </main>
  );
}

export default function WmsRegistryPage() {
  return (
    <ShellLayout>
      <WmsRegistryContent />
    </ShellLayout>
  );
}
