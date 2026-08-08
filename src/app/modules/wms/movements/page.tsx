"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Plus,
  RefreshCw,
  Server
} from "lucide-react";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Modal,
  ModalHeader
} from "@/components/ui";

interface WmsMovement {
  id: string;
  itemSku: string;
  itemName: string;
  type: "INCOMING" | "OUTGOING" | "TRANSFER" | "PERSONAL_CARD";
  quantity: number;
  fromLocation: string | null;
  toLocation: string | null;
  performedBy: string;
  reason: string | null;
  relatedOrderOrEq: string | null;
  createdAt: string;
}

interface WmsItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
}

interface EquipmentOption {
  id: string;
  equipmentCode: string;
  name: string;
}

export default function WmsMovementsPage() {
  const [movements, setMovements] = useState<WmsMovement[]>([]);
  const [items, setItems] = useState<WmsItem[]>([]);
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    itemId: "",
    type: "OUTGOING",
    quantity: 1,
    reason: "Плановое обслуживание / ремонт",
    relatedOrderOrEq: "",
    performedBy: "Кладовщик",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [movRes, itemsRes, eqRes] = await Promise.all([
        fetch("/api/modules/wms/movements"),
        fetch("/api/modules/wms/items"),
        fetch("/api/modules/eps/equipment")
      ]);
      const movData = await movRes.json();
      const itemsData = await itemsRes.json();
      const eqData = await eqRes.json();

      setMovements(movData.movements || []);
      setItems(itemsData.items || []);
      setEquipments(eqData.items || []);
      if (itemsData.items?.length > 0) {
        setFormData((prev) => ({ ...prev, itemId: itemsData.items[0].id }));
      }
    } catch (err) {
      console.error("Failed to load WMS movements:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Ошибка проведения складской операции");
      }
    } catch (err) {
      console.error("Movement submission error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="Складские операции & Списание на оборудование"
          description="Журнал движения ТМЦ, регистрация приходов и списаний запчастей на EPS единицы оборудования"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Обновить
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
              >
                <Plus size={14} />
                Оформить операцию / Списание
              </button>
            </div>
          }
        />

        <div className="rounded-xl border border-slate-800 bg-[#162238]/60 p-5">
          <DataTable
            keyExtractor={(row) => row.id}
            data={movements}
            columns={[
              {
                key: "createdAt",
                header: "Дата / Время",
                cell: (row) => (
                  <span className="text-xs text-slate-400">
                    {new Date(row.createdAt).toLocaleString("ru-RU")}
                  </span>
                ),
              },
              {
                key: "itemSku",
                header: "Артикул / ТМЦ",
                cell: (row) => (
                  <div>
                    <div className="font-semibold text-white">{row.itemName}</div>
                    <div className="text-[10px] text-slate-400">SKU: {row.itemSku}</div>
                  </div>
                ),
              },
              {
                key: "type",
                header: "Тип операции",
                cell: (row) => {
                  if (row.type === "INCOMING") {
                    return <StatusBadge status="ACTIVE" label="Приход (+)" />;
                  }
                  if (row.type === "OUTGOING" || row.type === "PERSONAL_CARD") {
                    return <StatusBadge status="DECOMMISSIONED" label="Списание (-)" />;
                  }
                  return <StatusBadge status="INACTIVE" label="Перемещение" />;
                },
              },
              {
                key: "quantity",
                header: "Количество",
                cell: (row) => <span className="font-bold text-white">{row.quantity}</span>,
              },
              {
                key: "reason",
                header: "Причина / Оборудование (EPS)",
                cell: (row) => (
                  <div>
                    <div className="text-xs text-slate-300">{row.reason || "Запланированное движение"}</div>
                    {row.relatedOrderOrEq && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400">
                        <Server size={10} /> {row.relatedOrderOrEq}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "performedBy",
                header: "Ответственный",
                cell: (row) => <span className="text-xs text-slate-400">{row.performedBy}</span>,
              },
            ]}
          />
        </div>

        <Modal open={showModal} onClose={() => setShowModal(false)}>
          <ModalHeader title="Регистрация движения / Списания ТМЦ" onClose={() => setShowModal(false)} />
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Выберите позицию ТМЦ *</label>
              <select
                required
                value={formData.itemId}
                onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (SKU: {i.sku}) — Остаток: {i.quantity} {i.unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Тип операции *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="INCOMING">Приход на склад (+)</option>
                  <option value="OUTGOING">Списание со склада (-)</option>
                  <option value="ADJUSTMENT">Корректировка остатка</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Количество *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Привязать к оборудованию EPS (необязательно)
              </label>
              <select
                value={formData.relatedOrderOrEq}
                onChange={(e) => setFormData({ ...formData, relatedOrderOrEq: e.target.value })}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- Без привязки к оборудованию --</option>
                {equipments.map((eq) => (
                  <option key={eq.id} value={`${eq.name} (${eq.equipmentCode})`}>
                    {eq.name} [{eq.equipmentCode}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Причина / Основание</label>
              <input
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Плановое обслуживание / Аварийная замена"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {submitting ? "Проведение..." : "Провести операцию"}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </ShellLayout>
  );
}
