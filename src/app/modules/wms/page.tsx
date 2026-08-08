"use client";

import { useState, useEffect, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Warehouse as WarehouseIcon,
  Box,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Plus,
  Tag,
  Layers
} from "lucide-react";
import Link from "next/link";
import {
  PageHeader,
  KpiGrid,
  Modal,
  ModalHeader,
  FilterToolbar,
  DataTable,
  StatusBadge,
} from "@/components/ui";

interface WmsItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  type: string;
  unit: string;
  warehouse: string;
  cell: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  currency: string;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "OVERSTOCKED";
  supplier?: string;
  description?: string;
}

export default function ConsolidatedWmsDashboardPage() {
  const [items, setItems] = useState<WmsItem[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "Запчасти",
    warehouse: "Склад №1",
    cell: "А-01-1",
    quantity: 10,
    minQuantity: 2,
    unit: "шт",
    unitPrice: 1500,
    supplier: "",
    description: ""
  });

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/modules/wms/items?query=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setItems(data.items || []))
      .catch((err) => console.error("Failed to load WMS items:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [query]);

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.category))).filter(Boolean);
  }, [items]);

  const warehouses = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.warehouse))).filter(Boolean);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (warehouseFilter !== "ALL" && item.warehouse !== warehouseFilter) return false;
      return true;
    });
  }, [items, categoryFilter, warehouseFilter]);

  const kpiStats = useMemo(() => {
    const totalPositions = items.length;
    const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0);
    const lowStockCount = items.filter((i) => i.status === "LOW_STOCK" || i.quantity <= i.minQuantity).length;
    const totalValue = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
    return { totalPositions, totalUnits, lowStockCount, totalValue };
  }, [items]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/modules/wms/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowCreateModal(false);
        setFormData({
          name: "",
          sku: "",
          category: "Запчасти",
          warehouse: "Склад №1",
          cell: "А-01-1",
          quantity: 10,
          minQuantity: 2,
          unit: "шт",
          unitPrice: 1500,
          supplier: "",
          description: ""
        });
        fetchData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Ошибка при добавлении ТМЦ");
      }
    } catch (err) {
      console.error("Create item error:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Дашборд & Каталог ТМЦ WMS"
          description={`Консолидированный дашборд складского учета и остатков ТМЦ (всего ${filteredItems.length} из ${items.length} поз.).`}
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет" },
          ]}
          actions={
            <>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Plus size={14} /> Добавить ТМЦ
              </button>
            </>
          }
        />

        {/* Quick KPI Summary Cards */}
        <KpiGrid
          items={[
            {
              label: "Всего наименований",
              value: kpiStats.totalPositions,
              icon: <Box size={14} />,
              iconColor: "blue",
              sub: "Артикулов в каталоге",
            },
            {
              label: "Суммарный остаток",
              value: kpiStats.totalUnits,
              icon: <WarehouseIcon size={14} />,
              iconColor: "emerald",
              sub: "Единиц на хранении",
              subColor: "emerald",
            },
            {
              label: "Дефицитные позиции",
              value: kpiStats.lowStockCount,
              icon: <AlertTriangle size={14} />,
              iconColor: "amber",
              sub: "Требуют пополнения",
              subColor: "amber",
            },
            {
              label: "Оценка запасов",
              value: `${kpiStats.totalValue.toLocaleString("ru-RU")} ₽`,
              icon: <TrendingUp size={14} />,
              iconColor: "indigo",
              sub: "Балансовая стоимость",
            },
          ]}
        />

        {/* Filter Toolbar */}
        <FilterToolbar
          searchQuery={query}
          onSearchChange={setQuery}
          searchPlaceholder="Поиск по наименованию, артикулу (SKU), ячейке..."
          filters={[
            {
              key: "category",
              label: "Категория",
              value: categoryFilter,
              onChange: setCategoryFilter,
              options: [
                { value: "ALL", label: "Все категории" },
                ...categories.map((c) => ({ value: c, label: c })),
              ],
            },
            {
              key: "warehouse",
              label: "Склад",
              value: warehouseFilter,
              onChange: setWarehouseFilter,
              options: [
                { value: "ALL", label: "Все склады" },
                ...warehouses.map((w) => ({ value: w, label: w })),
              ],
            },
          ]}
        />

        {/* Consolidated Items Catalog Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <DataTable
            keyExtractor={(row) => row.id}
            data={filteredItems}
            columns={[
              {
                key: "sku",
                header: "Артикул (SKU)",
                cell: (row) => (
                  <div className="font-mono">
                    <span className="block text-[11px] font-bold text-[#3473d4]">{row.sku}</span>
                    <span className="block text-[10px] text-slate-400">Штрихкод: {row.sku}</span>
                  </div>
                ),
              },
              {
                key: "name",
                header: "Наименование & Категория",
                cell: (row) => (
                  <div>
                    <span className="block text-[11px] font-semibold text-slate-700">{row.name}</span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                      <Tag size={10} />
                      <span>{row.category}</span>
                    </div>
                  </div>
                ),
              },
              {
                key: "warehouse",
                header: "Склад & Ячейка",
                cell: (row) => (
                  <div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                      <WarehouseIcon size={12} className="text-slate-400" />
                      <span>{row.warehouse}</span>
                    </div>
                    <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 mt-0.5">
                      Ячейка: {row.cell}
                    </span>
                  </div>
                ),
              },
              {
                key: "quantity",
                header: "Остаток",
                cell: (row) => (
                  <div>
                    <span className="text-[11px] font-bold text-slate-800">{row.quantity}</span>{" "}
                    <span className="text-[10px] text-slate-400">{row.unit}</span>
                    {row.quantity <= row.minQuantity && (
                      <span className="block text-[9px] font-semibold text-amber-600">
                        Мин: {row.minQuantity}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "unitPrice",
                header: "Цена за ед.",
                cell: (row) => (
                  <span className="text-[11px] font-medium text-slate-600">
                    {row.unitPrice.toLocaleString("ru-RU")} {row.currency}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Статус",
                cell: (row) => {
                  if (row.status === "IN_STOCK") return <StatusBadge status="ACTIVE" label="В наличии" />;
                  if (row.status === "LOW_STOCK") return <StatusBadge status="DRAFT" label="Заканчивается" />;
                  return <StatusBadge status="DECOMMISSIONED" label="Нет в наличии" />;
                },
              },
            ]}
          />
        </div>

        {/* Modal: Add New Item */}
        <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} size="lg">
          <ModalHeader
            icon={<Box size={16} />}
            title="Добавление новой позиции ТМЦ"
            subtitle="Заполните карточку номенклатурной единицы"
            onClose={() => setShowCreateModal(false)}
          />
          <form onSubmit={handleCreate} className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Артикул (SKU) *</label>
                <input
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="SKU-10023"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Наименование *</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Подшипник роликовый SKF"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Склад *</label>
                <input
                  required
                  value={formData.warehouse}
                  onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Ячейка хранения *</label>
                <input
                  required
                  value={formData.cell}
                  onChange={(e) => setFormData({ ...formData, cell: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Начальный остаток</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Мин. порог (остаток)</label>
                <input
                  type="number"
                  value={formData.minQuantity}
                  onChange={(e) => setFormData({ ...formData, minQuantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Цена за ед. (руб)</label>
                <input
                  type="number"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] disabled:opacity-50"
              >
                {creating ? "Сохранение..." : "Сохранить позицию"}
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </ShellLayout>
  );
}
