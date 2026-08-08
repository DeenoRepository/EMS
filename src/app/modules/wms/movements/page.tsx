"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Plus,
  RefreshCw,
  Server,
  History
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

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/modules/wms/movements").then((res) => (res.ok ? res.json() : { movements: [] })),
      fetch("/api/modules/wms/items").then((res) => (res.ok ? res.json() : { items: [] })),
      fetch("/api/modules/eps/equipment").then((res) => (res.ok ? res.json() : { items: [] }))
    ])
      .then(([movData, itemsData, eqData]) => {
        setMovements(movData.movements || []);
        setItems(itemsData.items || []);
        setEquipments(eqData.items || []);
        if (itemsData.items?.length > 0) {
          setFormData((prev) => ({ ...prev, itemId: itemsData.items[0].id }));
        }
      })
      .catch((err) => console.error("Failed to load WMS movements:", err))
      .finally(() => setLoading(false));
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
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Складские операции & Списание на оборудование"
          description="Журнал движения ТМЦ, регистрация приходов и списаний запчастей на EPS единицы оборудования"
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет", href: "/modules/wms" },
            { title: "Движения & Списание" },
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
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Plus size={14} /> Оформить операцию
              </button>
            </>
          }
        />

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <DataTable
            keyExtractor={(row) => row.id}
            data={movements}
            columns={[
              {
                key: "createdAt",
                header: "Дата / Время",
                cell: (row) => (
                  <span className="text-[11px] text-slate-500">
                    {new Date(row.createdAt).toLocaleString("ru-RU")}
                  </span>
                ),
              },
              {
                key: "itemSku",
                header: "Артикул / ТМЦ",
                cell: (row) => (
                  <div className="font-mono">
                    <span className="block text-[11px] font-bold text-[#3473d4]">{row.itemName}</span>
                    <span className="block text-[10px] text-slate-400">SKU: {row.itemSku}</span>
                  </div>
                ),
              },
              {
                key: "type",
                header: "Тип операции",
                cell: (row) => {
                  if (row.type === "INCOMING") return <StatusBadge status="ACTIVE" label="Приход (+)" />;
                  if (row.type === "OUTGOING" || row.type === "PERSONAL_CARD") return <StatusBadge status="DECOMMISSIONED" label="Списание (-)" />;
                  return <StatusBadge status="INACTIVE" label="Перемещение" />;
                },
              },
              {
                key: "quantity",
                header: "Количество",
                cell: (row) => <span className="text-[11px] font-bold text-slate-800">{row.quantity}</span>,
              },
              {
                key: "reason",
                header: "Причина / Оборудование (EPS)",
                cell: (row) => (
                  <div>
                    <div className="text-[11px] text-slate-700">{row.reason || "Запланированное движение"}</div>
                    {row.relatedOrderOrEq && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#3473d4]">
                        <Server size={10} /> {row.relatedOrderOrEq}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "performedBy",
                header: "Ответственный",
                cell: (row) => <span className="text-[11px] text-slate-500">{row.performedBy}</span>,
              },
            ]}
          />
        </div>

        <Modal open={showModal} onClose={() => setShowModal(false)} size="lg">
          <ModalHeader
            icon={<History size={16} />}
            title="Регистрация движения / Списания ТМЦ"
            subtitle="Выберите позицию ТМЦ и основание выполнения операции"
            onClose={() => setShowModal(false)}
          />
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Выберите позицию ТМЦ *</label>
              <select
                required
                value={formData.itemId}
                onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
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
                <label className="mb-1 block text-xs font-semibold text-slate-700">Тип операции *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="INCOMING">Приход на склад (+)</option>
                  <option value="OUTGOING">Списание со склада (-)</option>
                  <option value="ADJUSTMENT">Корректировка остатка</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Количество *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Привязать к оборудованию EPS (необязательно)
              </label>
              <select
                value={formData.relatedOrderOrEq}
                onChange={(e) => setFormData({ ...formData, relatedOrderOrEq: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
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
              <label className="mb-1 block text-xs font-semibold text-slate-700">Причина / Основание</label>
              <input
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Плановое обслуживание / Аварийная замена"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] disabled:opacity-50"
              >
                {submitting ? "Проведение..." : "Провести операцию"}
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </ShellLayout>
  );
}
