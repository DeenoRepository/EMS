"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader, SearchableSelect } from "@/components/ui";
import { FileSpreadsheet } from "lucide-react";
import { WmsItem, EquipmentOption, WriteOffPayload } from "@/types/wms";

interface WriteOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  items?: WmsItem[];
  equipments?: EquipmentOption[];
  defaultItemId?: string;
}

export function WriteOffModal({
  isOpen,
  onClose,
  onSuccess,
  items = [],
  equipments = [],
  defaultItemId
}: WriteOffModalProps) {
  const safeItems = items || [];
  const safeEquipments = equipments || [];

  const [formData, setFormData] = useState<WriteOffPayload>({
    itemId: defaultItemId || (safeItems[0]?.id || ""),
    quantity: 1,
    reason: "EQUIPMENT_REPAIR",
    equipmentName: "",
    performedBy: "Петров А.В. (Инженер)",
    comments: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        itemId: defaultItemId || prev.itemId || (safeItems[0]?.id || "")
      }));
    }
  }, [isOpen, defaultItemId, safeItems]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemId || formData.quantity <= 0) {
      alert("Укажите позицию и количество для списания");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/write-offs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при выполнении списания");
      }
    } catch (err) {
      console.error("Failed to write off WMS item:", err);
      alert("Ошибка сети при отправке акта списания");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedItem = safeItems.find((i) => i.id === formData.itemId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader title="Списание ТМЦ / Акт установки в ТОИР" onClose={onClose} />
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Выберите ТМЦ для списания *
          </label>
          <SearchableSelect
            options={safeItems.map((i) => ({
              value: i.id,
              label: `${i.name} (SKU: ${i.sku}) — Доступно: ${i.quantity} ${i.unit}`
            }))}
            value={formData.itemId}
            onChange={(val) => setFormData({ ...formData, itemId: val })}
            placeholder="Поиск номенклатуры..."
          />
          {selectedItem && (
            <div className="mt-1 text-[11px] text-slate-500">
              Текущий остаток на складе:{" "}
              <span className="font-bold text-slate-700">
                {selectedItem.quantity} {selectedItem.unit}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Количество к списанию *
            </label>
            <input
              type="number"
              min="1"
              max={selectedItem?.quantity || 9999}
              required
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Причина списания</label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="EQUIPMENT_REPAIR">Ремонт / ТО оборудования</option>
              <option value="SCRAP">Брак / Поломка</option>
              <option value="NON_LIQUID">Неликвид / Истек срок</option>
              <option value="DAMAGE">Повреждение при транспортировке</option>
              <option value="OTHER">Прочее списание</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Оборудование / Агрегат-получатель (EPS)
          </label>
          <SearchableSelect
            options={safeEquipments.map((e) => ({
              value: `${e.name} (${e.equipmentCode})`,
              label: `${e.name} [${e.equipmentCode}]`
            }))}
            value={formData.equipmentName || ""}
            onChange={(val) => setFormData({ ...formData, equipmentName: val })}
            placeholder="Выберите оборудование для привязки расхода..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Ответственный (МОЛ)</label>
          <input
            type="text"
            required
            value={formData.performedBy}
            onChange={(e) => setFormData({ ...formData, performedBy: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Основание / Заметка</label>
          <textarea
            rows={2}
            value={formData.comments || ""}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            placeholder="Укажите дефектную ведомость или номер наряда-допуска..."
          />
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
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            <FileSpreadsheet size={14} /> {submitting ? "Списание..." : "Провести списание"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
