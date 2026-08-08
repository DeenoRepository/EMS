"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { ArrowLeftRight, Plus, RefreshCw, Send, CheckCircle, Clock, Bell, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { PageHeader, DataTable, StatusBadge, Modal, ModalHeader, SearchableSelect } from "@/components/ui";
import { useShell } from "@/components/layout/shell-context";

interface WmsItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unit: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface RequisitionItem {
  id?: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  quantity: number;
}

interface WmsRequisition {
  id: string;
  requisitionNumber: string;
  fromWarehouse: string;
  toWarehouse: string;
  requestedBy: string;
  status: "DRAFT" | "REQUESTED" | "APPROVED" | "IN_TRANSIT" | "COMPLETED" | "REJECTED";
  note?: string;
  createdAt: string;
  items: RequisitionItem[];
}

function WmsRequisitionsPageContent() {
  const { refreshPendingWmsRequisitions } = useShell();
  const [requisitions, setRequisitions] = useState<WmsRequisition[]>([]);
  const [items, setItems] = useState<WmsItem[]>([]);
  const [warehousesList, setWarehousesList] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);

  interface ReqRow {
    id: string;
    selectedItemId: string;
    quantity: number;
  }

  const [reqItemsRows, setReqItemsRows] = useState<ReqRow[]>([
    { id: "1", selectedItemId: "", quantity: 1 }
  ]);

  const [reqHeader, setReqHeader] = useState({
    fromWarehouse: "",
    toWarehouse: "",
    requestedBy: "Инженер Редактор (editor)",
    note: ""
  });

  const addReqRow = () => {
    const defaultItemId = items[0]?.id || "";
    setReqItemsRows((prev) => [
      ...prev,
      { id: Date.now().toString(), selectedItemId: defaultItemId, quantity: 1 }
    ]);
  };

  const removeReqRow = (id: string) => {
    if (reqItemsRows.length <= 1) return;
    setReqItemsRows((prev) => prev.filter((r) => r.id !== id));
  };

  const fetchData = () => {
    setLoading(true);
    refreshPendingWmsRequisitions();
    Promise.all([
      fetch("/api/modules/wms/requisitions").then((r) => (r.ok ? r.json() : { requisitions: [] })),
      fetch("/api/modules/wms/items").then((r) => (r.ok ? r.json() : { items: [] })),
      fetch("/api/modules/wms/warehouses").then((r) => (r.ok ? r.json() : { warehouses: [] }))
    ])
      .then(([reqsData, itemsData, whData]) => {
        setRequisitions(reqsData.requisitions || []);
        const loadedItems = itemsData.items || [];
        setItems(loadedItems);
        const whs = whData.warehouses || [];
        setWarehousesList(whs);

        if (whs.length > 0) {
          setReqHeader((prev) => ({
            ...prev,
            fromWarehouse: prev.fromWarehouse || whs[0].name,
            toWarehouse: prev.toWarehouse || (whs[1]?.name || whs[0].name)
          }));
        }
        if (loadedItems.length > 0) {
          setReqItemsRows((prev) =>
            prev.map((r) => (r.selectedItemId ? r : { ...r, selectedItemId: loadedItems[0].id }))
          );
        }
      })
      .catch((err) => console.error("Requisitions query error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    const payloadItems = reqItemsRows
      .map((row) => {
        const item = items.find((i) => i.id === row.selectedItemId);
        if (!item) return null;
        return {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          quantity: row.quantity
        };
      })
      .filter(Boolean);

    if (payloadItems.length === 0) {
      alert("Выберите хотя бы одну позицию ТМЦ для запроса");
      return;
    }

    try {
      const res = await fetch("/api/modules/wms/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWarehouse: reqHeader.fromWarehouse,
          toWarehouse: reqHeader.toWarehouse,
          requestedBy: reqHeader.requestedBy,
          note: reqHeader.note,
          items: payloadItems
        })
      });
      if (res.ok) {
        setShowRequisitionModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при создании запроса");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/modules/wms/requisitions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const pendingRequisitions = requisitions.filter((r) => r.status === "REQUESTED");

  return (
    <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Журнал межскладских запросов"
          description="Оперативные заявки кладовщиков на перемещение номенклатуры со сторонних складов."
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет", href: "/modules/wms" },
            { title: "Межскладские запросы" }
          ]}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
              </button>
              <button
                onClick={() => setShowRequisitionModal(true)}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                <Plus size={14} /> Создать запрос
              </button>
            </div>
          }
        />

        {/* NOTIFICATION BANNER: Pending Incoming Requisitions */}
        {pendingRequisitions.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                <Bell size={16} className="text-amber-600 animate-bounce" />
                <span>Входящие запросы на перемещение ТМЦ от других складов ({pendingRequisitions.length})</span>
              </div>
              <span className="text-[10px] text-amber-700 font-semibold uppercase tracking-wider">
                Требуется согласование МОЛ
              </span>
            </div>

            <div className="space-y-2">
              {pendingRequisitions.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-lg border border-amber-200/80 bg-white px-3.5 py-2.5 shadow-2xs text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <span className="font-mono text-indigo-600 font-bold">{req.requisitionNumber}</span>
                      <span>Запросил: <strong className="text-blue-600">{req.fromWarehouse}</strong> у <strong className="text-slate-800">{req.toWarehouse}</strong></span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Позиции: {req.items?.map((it) => `${it.itemName} (${it.quantity} шт)`).join(", ")} | Автор: {req.requestedBy}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStatusChange(req.id, "APPROVED")}
                      className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-2xs hover:bg-emerald-700"
                    >
                      <CheckCircle2 size={13} /> Согласовать
                    </button>
                    <button
                      onClick={() => handleStatusChange(req.id, "REJECTED")}
                      className="flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-2xs hover:bg-rose-700"
                    >
                      <XCircle size={13} /> Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DataTable
          columns={[
            {
              key: "number",
              header: "Номер & Дата",
              cell: (row: WmsRequisition) => (
                <div>
                  <div className="font-mono text-xs font-bold text-indigo-600">{row.requisitionNumber}</div>
                  <div className="text-[10px] text-slate-400">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </div>
                </div>
              )
            },
            {
              key: "warehouses",
              header: "Склад-источник ➔ Получатель",
              cell: (row: WmsRequisition) => (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <span>{row.fromWarehouse}</span>
                  <ArrowLeftRight size={12} className="text-slate-400" />
                  <span className="text-blue-600">{row.toWarehouse}</span>
                </div>
              )
            },
            {
              key: "items",
              header: "Запрошенные позиции",
              cell: (row: WmsRequisition) => (
                <div className="space-y-0.5">
                  {row.items?.map((it, idx) => (
                    <div key={idx} className="text-xs text-slate-800 font-medium">
                      {it.itemName} <span className="font-bold text-blue-600">x{it.quantity}</span>
                    </div>
                  ))}
                </div>
              )
            },
            {
              key: "requestedBy",
              header: "Запросил",
              cell: (row: WmsRequisition) => (
                <span className="text-xs text-slate-600 font-medium">{row.requestedBy}</span>
              )
            },
            {
              key: "status",
              header: "Статус",
              cell: (row: WmsRequisition) => {
                const statusMap: Record<string, { label: string; status: string }> = {
                  REQUESTED: { label: "Запрошено", status: "PENDING" },
                  APPROVED: { label: "Утверждено", status: "APPROVED" },
                  IN_TRANSIT: { label: "В пути", status: "PENDING" },
                  COMPLETED: { label: "Принято", status: "APPROVED" },
                  REJECTED: { label: "Отклонено", status: "REJECTED" }
                };
                const s = statusMap[row.status] || { label: row.status, status: "DRAFT" };
                return <StatusBadge status={s.status} label={s.label} />;
              }
            },
            {
              key: "actions",
              header: "Действия",
              cell: (row: WmsRequisition) => (
                <div className="flex items-center gap-1.5">
                  {row.status === "REQUESTED" && (
                    <button
                      onClick={() => handleStatusChange(row.id, "APPROVED")}
                      className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Утвердить
                    </button>
                  )}
                  {row.status === "APPROVED" && (
                    <button
                      onClick={() => handleStatusChange(row.id, "IN_TRANSIT")}
                      className="rounded bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Отправить
                    </button>
                  )}
                  {row.status === "IN_TRANSIT" && (
                    <button
                      onClick={() => handleStatusChange(row.id, "COMPLETED")}
                      className="rounded bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100"
                    >
                      Подтвердить прием
                    </button>
                  )}
                </div>
              )
            }
          ]}
          data={requisitions}
          keyExtractor={(row) => row.id}
        />

        <Modal open={showRequisitionModal} onClose={() => setShowRequisitionModal(false)} size="xl">
          <ModalHeader
            icon={<Send size={16} />}
            title="Запрос ТМЦ у другого склада"
            subtitle="Формирование заявки для ответственного кладовщика (МОЛ) склада-поставщика"
            onClose={() => setShowRequisitionModal(false)}
          />
          <form onSubmit={handleCreateRequisition} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Склад-Получатель *</label>
                <select
                  value={reqHeader.fromWarehouse}
                  onChange={(e) => setReqHeader({ ...reqHeader, fromWarehouse: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {warehousesList.map((w) => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Склад-Поставщик *</label>
                <select
                  value={reqHeader.toWarehouse}
                  onChange={(e) => setReqHeader({ ...reqHeader, toWarehouse: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {warehousesList.map((w) => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-2 pt-2">
              <span className="text-xs font-semibold text-slate-700">Запрашиваемые позиции ТМЦ ({reqItemsRows.length}):</span>
              <button
                type="button"
                onClick={addReqRow}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                <Plus size={13} /> Добавить позицию
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
              {reqItemsRows.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-12 gap-3 items-center rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="col-span-8">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Выберите ТМЦ #{idx + 1} *</label>
                    <SearchableSelect
                      items={items}
                      selectedId={row.selectedItemId}
                      onSelect={(selectedItem) => {
                        setReqItemsRows(reqItemsRows.map((r) => (r.id === row.id ? { ...r, selectedItemId: selectedItem.id } : r)));
                      }}
                      placeholder="Поиск по названию или SKU..."
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Количество *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setReqItemsRows(reqItemsRows.map((r) => (r.id === row.id ? { ...r, quantity: val } : r)));
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1 flex items-center justify-center pt-4">
                    <button
                      type="button"
                      disabled={reqItemsRows.length <= 1}
                      onClick={() => removeReqRow(row.id)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Примечание / Обоснование</label>
              <input
                type="text"
                value={reqHeader.note}
                onChange={(e) => setReqHeader({ ...reqHeader, note: e.target.value })}
                placeholder="Для закрытия аварийной заявки ТОИР"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowRequisitionModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
              >
                Отправить запрос кладовщику
              </button>
            </div>
          </form>
        </Modal>
      </main>
  );
}

export default function WmsRequisitionsPage() {
  return (
    <ShellLayout>
      <WmsRequisitionsPageContent />
    </ShellLayout>
  );
}
