"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Box,
  Plus,
  RefreshCw,
  AlertTriangle,
  Warehouse as WarehouseIcon
} from "lucide-react";
import {
  PageHeader,
  FilterToolbar,
  DataTable,
  StatusBadge,
  Modal,
  ModalHeader
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

export default function WmsItemsPage() {
  const [items, setItems] = useState<WmsItem[]>([]);
  const [query, setQuery] = useState("");
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

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/modules/wms/items?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to fetch WMS items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [query]);

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
        fetchItems();
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
      <div className="space-y-6">
        <PageHeader
          title="Каталог & Остатки ТМЦ"
          description="Учет номенклатуры запчастей, инструментов и расходных материалов"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={fetchItems}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Обновить
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
              >
                <Plus size={14} />
                Добавить ТМЦ
              </button>
            </div>
          }
        />

        <FilterToolbar
          searchQuery={query}
          onSearchChange={setQuery}
        />

        <div className="rounded-xl border border-slate-800 bg-[#162238]/60 p-5">
          <DataTable
            keyExtractor={(row) => row.id}
            data={items}
            columns={[
              {
                key: "sku",
                header: "Артикул (SKU)",
                cell: (row) => (
                  <span className="font-mono text-xs font-semibold text-blue-400">{row.sku}</span>
                ),
              },
              {
                key: "name",
                header: "Наименование / Категория",
                cell: (row) => (
                  <div>
                    <div className="font-semibold text-white">{row.name}</div>
                    <div className="text-[10px] text-slate-400">{row.category}</div>
                  </div>
                ),
              },
              {
                key: "warehouse",
                header: "Склад & Ячейка",
                cell: (row) => (
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <WarehouseIcon size={12} className="text-slate-400" />
                    <span>{row.warehouse}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {row.cell}
                    </span>
                  </div>
                ),
              },
              {
                key: "quantity",
                header: "Остаток",
                cell: (row) => (
                  <div>
                    <span className="font-bold text-white">{row.quantity}</span>{" "}
                    <span className="text-xs text-slate-400">{row.unit}</span>
                    {row.quantity <= row.minQuantity && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-400">
                        <AlertTriangle size={10} /> Мин: {row.minQuantity}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "unitPrice",
                header: "Цена за ед.",
                cell: (row) => (
                  <span className="text-xs text-slate-300">
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

        <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
          <ModalHeader title="Добавление новой позиции ТМЦ" onClose={() => setShowCreateModal(false)} />
          <form onSubmit={handleCreate} className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Артикул (SKU) *</label>
                <input
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="SKU-10023"
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Наименование *</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Подшипник роликовый SKF"
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Склад *</label>
                <input
                  required
                  value={formData.warehouse}
                  onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Ячейка хранения *</label>
                <input
                  required
                  value={formData.cell}
                  onChange={(e) => setFormData({ ...formData, cell: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Начальный остаток</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Мин. порог (остаток)</label>
                <input
                  type="number"
                  value={formData.minQuantity}
                  onChange={(e) => setFormData({ ...formData, minQuantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Цена за ед. (руб)</label>
                <input
                  type="number"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {creating ? "Сохранение..." : "Сохранить позицию"}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </ShellLayout>
  );
}
