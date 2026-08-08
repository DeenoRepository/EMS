"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader, SearchableSelect } from "@/components/ui";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
import { WmsItem, Warehouse, TransferRowPayload, TransferHeaderPayload } from "@/types/wms";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  items?: WmsItem[];
  warehouses?: Warehouse[];
  initialSelectedIds?: string[];
  currentUserDisplayName?: string;
}

export function TransferModal({
  isOpen,
  onClose,
  onSuccess,
  items = [],
  warehouses = [],
  initialSelectedIds = [],
  currentUserDisplayName = "Инженер (editor)"
}: TransferModalProps) {
  const safeItems = items || [];
  const safeWarehouses = warehouses || [];

  const [header, setHeader] = useState<TransferHeaderPayload>({
    fromWarehouse: safeWarehouses[0]?.name || "",
    toWarehouse: safeWarehouses[1]?.name || safeWarehouses[0]?.name || "",
    reason: "Перемещение ТМЦ между складами МОЛ"
  });

  const [rows, setRows] = useState<TransferRowPayload[]>([
    { id: "1", itemId: safeItems[0]?.id || "", quantity: 1 }
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
        const selectedRows = initialSelectedIds.map((id, idx) => ({
          id: String(idx + 1),
          itemId: id,
          quantity: 1
        }));
        setRows(selectedRows);
      } else if (safeItems.length > 0) {
        setRows([{ id: "1", itemId: safeItems[0].id, quantity: 1 }]);
      }
    }
  }, [isOpen, initialSelectedIds, safeItems, safeWarehouses]);

  if (!isOpen) return null;

  const addRow = () => {
    const defaultItemId = safeItems[0]?.id || "";
    setRows((prev) => [...prev, { id: Date.now().toString(), itemId: defaultItemId, quantity: 1 }]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (header.fromWarehouse === header.toWarehouse) {
      alert("Склад-отправитель и склад-получатель должны различаться");
      return;
    }

    const payloadItems = rows
      .map((r) => {
        const item = safeItems.find((i) => i.id === r.itemId);
        if (!item) return null;
        return {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          quantity: r.quantity,
          fromWarehouse: header.fromWarehouse,
          toWarehouse: header.toWarehouse,
          requestedBy: currentUserDisplayName,
          targetMolUser: "Складской МОЛ",
          reason: header.reason
        };
      })
      .filter(Boolean);

    if (payloadItems.length === 0) {
      alert("Выберите хотя бы одну позицию для перемещения");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems })
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка создания перемещений");
      }
    } catch (err) {
      console.error("Failed to transfer items:", err);
      alert("Ошибка сети при создании трансфера");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader title="Перемещение ТМЦ между складами" onClose={onClose} />
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Склад-отправитель *</label>
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
          <label className="block text-xs font-medium text-slate-700 mb-1">Причина / Основание</label>
          <input
            type="text"
            value={header.reason || ""}
            onChange={(e) => setHeader({ ...header, reason: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            placeholder="Перемещение под плановый ремонт..."
          />
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700">Позиции ТМЦ для перемещения</h4>
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
              const currentItem = safeItems.find((i) => i.id === row.itemId);
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 bg-slate-50/50"
                >
                  <div className="flex-1">
                    <SearchableSelect
                      options={safeItems.map((i) => ({
                        value: i.id,
                        label: `${i.name} (${i.sku}) — Доступно: ${i.quantity} ${i.unit}`
                      }))}
                      value={row.itemId}
                      onChange={(val) =>
                        setRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, itemId: val } : r))
                        )
                      }
                      placeholder="Выберите ТМЦ..."
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      min="1"
                      max={currentItem?.quantity || 9999}
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
            <ArrowLeftRight size={14} /> {submitting ? "Создание..." : "Оформить перемещение"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
