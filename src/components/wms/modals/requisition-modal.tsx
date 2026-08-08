"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader, SearchableSelect } from "@/components/ui";
import { Send, Plus, Trash2 } from "lucide-react";
import { WmsItem, Warehouse, RequisitionRowPayload, RequisitionHeaderPayload } from "@/types/wms";

interface RequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  items?: WmsItem[];
  warehouses?: Warehouse[];
  initialSelectedIds?: string[];
  currentUserDisplayName?: string;
}

export function RequisitionModal({
  isOpen,
  onClose,
  onSuccess,
  items = [],
  warehouses = [],
  initialSelectedIds = [],
  currentUserDisplayName = "Инженер (editor)"
}: RequisitionModalProps) {
  const safeItems = items || [];
  const safeWarehouses = warehouses || [];

  const [header, setHeader] = useState<RequisitionHeaderPayload>({
    fromWarehouse: safeWarehouses[0]?.name || "",
    toWarehouse: safeWarehouses[1]?.name || safeWarehouses[0]?.name || "",
    requestedBy: currentUserDisplayName,
    note: ""
  });

  const [rows, setRows] = useState<RequisitionRowPayload[]>([
    { id: "1", selectedItemId: safeItems[0]?.id || "", quantity: 1, isPreselected: false }
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (safeWarehouses.length > 0) {
        setHeader((prev) => ({
          ...prev,
          fromWarehouse: prev.fromWarehouse || safeWarehouses[0].name,
          toWarehouse: prev.toWarehouse || safeWarehouses[1]?.name || safeWarehouses[0].name
        }));
      }

      if (initialSelectedIds.length > 0) {
        const selectedRows = initialSelectedIds.map((id, index) => ({
          id: String(index + 1),
          selectedItemId: id,
          quantity: 1,
          isPreselected: true
        }));
        setRows(selectedRows);
      } else if (safeItems.length > 0) {
        setRows([{ id: "1", selectedItemId: safeItems[0].id, quantity: 1, isPreselected: false }]);
      }
    }
  }, [isOpen, initialSelectedIds, safeItems, safeWarehouses]);

  if (!isOpen) return null;

  const addRow = () => {
    const defaultItemId = safeItems[0]?.id || "";
    setRows((prev) => [
      ...prev,
      { id: Date.now().toString(), selectedItemId: defaultItemId, quantity: 1, isPreselected: false }
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (header.fromWarehouse === header.toWarehouse) {
      alert("Склад-отправитель и склад-получатель должны быть разными");
      return;
    }

    const payloadItems = rows
      .map((row) => {
        const item = safeItems.find((i) => i.id === row.selectedItemId);
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

    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWarehouse: header.fromWarehouse,
          toWarehouse: header.toWarehouse,
          requestedBy: header.requestedBy,
          note: header.note,
          items: payloadItems
        })
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при создании заявки на перемещение");
      }
    } catch (err) {
      console.error("Failed to create requisition:", err);
      alert("Ошибка сети при отправке заявки");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader title="Запрос перемещения ТМЦ со склада" onClose={onClose} />
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Склад-источник *</label>
            <select
              value={header.fromWarehouse}
              onChange={(e) => setHeader({ ...header, fromWarehouse: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            >
              {safeWarehouses.map((w) => (
                <option key={w.id} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Склад-получатель *</label>
            <select
              value={header.toWarehouse}
              onChange={(e) => setHeader({ ...header, toWarehouse: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            >
              {safeWarehouses.map((w) => (
                <option key={w.id} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Заявитель / ФИО МОЛ</label>
          <input
            type="text"
            required
            value={header.requestedBy}
            onChange={(e) => setHeader({ ...header, requestedBy: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Примечание / Назначение</label>
          <textarea
            rows={2}
            value={header.note || ""}
            onChange={(e) => setHeader({ ...header, note: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            placeholder="Срочная замена под ремонт насосного узла..."
          />
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700">Запрашиваемые позиции</h4>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Plus size={14} /> Добавить позицию
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {rows.map((row) => {
              const currentItem = safeItems.find((i) => i.id === row.selectedItemId);
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 bg-slate-50/50"
                >
                  <div className="flex-1">
                    <SearchableSelect
                      options={safeItems.map((i) => ({
                        value: i.id,
                        label: `${i.name} (${i.sku}) — Остаток: ${i.quantity} ${i.unit}`
                      }))}
                      value={row.selectedItemId}
                      onChange={(val) =>
                        setRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, selectedItemId: val } : r))
                        )
                      }
                      placeholder="Поиск номенклатуры..."
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id
                              ? { ...r, quantity: parseInt(e.target.value) || 1 }
                              : r
                          )
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                      placeholder="Кол-во"
                    />
                  </div>

                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send size={14} /> {submitting ? "Отправка..." : "Отправить заявку"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
