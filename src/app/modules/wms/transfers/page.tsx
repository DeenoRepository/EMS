"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  ArrowRightLeft,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Warehouse as WarehouseIcon
} from "lucide-react";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Modal,
  ModalHeader
} from "@/components/ui";

interface WmsTransferRequest {
  id: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  fromWarehouse: string;
  toWarehouse: string;
  requestedBy: string;
  targetMolUser: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: string;
}

interface Warehouse {
  id: string;
  name: string;
  responsibleUser: string;
}

interface WmsItem {
  id: string;
  sku: string;
  name: string;
  warehouse: string;
  quantity: number;
}

export default function WmsTransfersPage() {
  const [requests, setRequests] = useState<WmsTransferRequest[]>([]);
  const [items, setItems] = useState<WmsItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    itemId: "",
    quantity: 1,
    toWarehouse: "",
    reason: "Производственная необходимость",
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/modules/wms/transfers").then((res) => (res.ok ? res.json() : { requests: [] })),
      fetch("/api/modules/wms/items").then((res) => (res.ok ? res.json() : { items: [] })),
      fetch("/api/modules/wms/warehouses").then((res) => (res.ok ? res.json() : { warehouses: [] }))
    ])
      .then(([reqData, itemsData, whData]) => {
        setRequests(reqData.requests || []);
        setItems(itemsData.items || []);
        const whList = whData.warehouses || [];
        setWarehouses(whList);

        if (itemsData.items?.length > 0) {
          setFormData((prev) => ({
            ...prev,
            itemId: itemsData.items[0].id,
            toWarehouse: whList.find((w: Warehouse) => w.name !== itemsData.items[0].warehouse)?.name || whList[0]?.name || ""
          }));
        }
      })
      .catch((err) => console.error("Failed to load transfers:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Автоматический подбор МОЛ целевого склада при выборе склада назначения
  const selectedItem = items.find((i) => i.id === formData.itemId);
  const targetWarehouseObj = warehouses.find((w) => w.name === formData.toWarehouse);
  const availableTargetWarehouses = warehouses.filter((w) => w.name !== selectedItem?.warehouse);

  const handleAction = async (requestId: string, action: "APPROVE" | "REJECT") => {
    try {
      const res = await fetch("/api/modules/wms/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requestId })
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при обработке перемещения");
      }
    } catch (err) {
      console.error("Transfer action error:", err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          targetMolUser: targetWarehouseObj?.responsibleUser || ""
        })
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка создания заявки на перемещение");
      }
    } catch (err) {
      console.error("Create transfer error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Межскладские перемещения (МОЛ)"
          description="Двухэтапное согласование и передача ТМЦ между материально ответственными лицами складов"
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет", href: "/modules/wms" },
            { title: "Перемещения МОЛ" },
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
                <Plus size={14} /> Создать запрос на передачу
              </button>
            </>
          }
        />

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <DataTable
            keyExtractor={(row) => row.id}
            data={requests}
            columns={[
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
                key: "fromWarehouse",
                header: "Отправитель -> Получатель",
                cell: (row) => (
                  <div className="text-[11px] text-slate-700 font-semibold flex items-center gap-1.5">
                    <span>{row.fromWarehouse}</span>
                    <ArrowRightLeft size={12} className="text-slate-400" />
                    <span className="text-[#3473d4]">{row.toWarehouse}</span>
                  </div>
                ),
              },
              {
                key: "quantity",
                header: "Количество",
                cell: (row) => <span className="text-[11px] font-bold text-slate-800">{row.quantity}</span>,
              },
              {
                key: "targetMolUser",
                header: "Ответственные МОЛ",
                cell: (row) => (
                  <div>
                    <span className="block text-[11px] font-medium text-slate-700">Инициатор: {row.requestedBy}</span>
                    <span className="block text-[10px] text-blue-600">Приемщик МОЛ: {row.targetMolUser}</span>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Статус",
                cell: (row) => {
                  if (row.status === "APPROVED") return <StatusBadge status="ACTIVE" label="Принято МОЛ" />;
                  if (row.status === "REJECTED") return <StatusBadge status="REJECTED" label="Отклонено" />;
                  return <StatusBadge status="DRAFT" label="Ожидает приемки" />;
                },
              },
              {
                key: "actions",
                header: "Действия МОЛ",
                className: "text-right",
                cell: (row) => (
                  <div className="flex items-center justify-end gap-2">
                    {row.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleAction(row.id, "APPROVE")}
                          className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
                        >
                          <CheckCircle2 size={11} /> Принять на склад
                        </button>
                        <button
                          onClick={() => handleAction(row.id, "REJECT")}
                          className="flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-rose-500"
                        >
                          <XCircle size={11} /> Отклонить
                        </button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* Modal: New Transfer Request with Automatic Warehouse/MOL Selection */}
        <Modal open={showModal} onClose={() => setShowModal(false)} size="lg">
          <ModalHeader
            icon={<ArrowRightLeft size={16} />}
            title="Запрос на межскладское перемещение"
            subtitle="Выберите позицию ТМЦ и целевой склад (МОЛ подтянется автоматически)"
            onClose={() => setShowModal(false)}
          />
          <form onSubmit={handleCreate} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Выберите позицию ТМЦ со своего склада *</label>
              <select
                required
                value={formData.itemId}
                onChange={(e) => {
                  const newId = e.target.value;
                  const itemObj = items.find((i) => i.id === newId);
                  const validTargetWh = warehouses.find((w) => w.name !== itemObj?.warehouse)?.name || "";
                  setFormData({ ...formData, itemId: newId, toWarehouse: validTargetWh });
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (SKU: {i.sku}) — Исходный Склад: {i.warehouse} (Остаток: {i.quantity})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Количество для передачи *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Склад назначения (Получатель) *</label>
                <select
                  required
                  value={formData.toWarehouse}
                  onChange={(e) => setFormData({ ...formData, toWarehouse: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {availableTargetWarehouses.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name} (МОЛ: {w.responsibleUser})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {targetWarehouseObj && (
              <div className="rounded-lg bg-blue-50/60 p-3 border border-blue-100 text-xs">
                <span className="font-semibold text-blue-900">Автоматически определен МОЛ-приемщик:</span>{" "}
                <span className="font-bold text-blue-700">{targetWarehouseObj.responsibleUser}</span>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Причина / Основание передачи</label>
              <input
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
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
                {submitting ? "Отправка..." : "Отправить запрос МОЛ"}
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </ShellLayout>
  );
}
