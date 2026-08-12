"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader, SearchableSelect } from "@/components/ui";
import { FileSpreadsheet, AlertCircle, Barcode, CheckCircle2 } from "lucide-react";
import { WmsItem, EquipmentOption, WriteOffPayload } from "@/types/wms";
import { getAvailableStock, validateStockLimit, scanBarcodeStub, checkDirtyFormClose } from "./wms-modal-utils";

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

  const [isDirty, setIsDirty] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setIsDirty(false);
      setErrorMessage(null);
      setBarcodeInput("");
      setFormData((prev) => ({
        ...prev,
        itemId: defaultItemId || prev.itemId || (safeItems[0]?.id || "")
      }));
    }
  }, [isOpen, defaultItemId, safeItems]);

  if (!isOpen) return null;

  const selectedItem = safeItems.find((i) => i.id === formData.itemId);
  const availableStock = getAvailableStock(selectedItem);
  const stockValidation = validateStockLimit(formData.quantity, availableStock);

  const updateForm = (fields: Partial<WriteOffPayload>) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleBarcodeScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    scanBarcodeStub(
      barcodeInput,
      safeItems,
      (matchedItem) => {
        setIsDirty(true);
        setFormData((prev) => ({ ...prev, itemId: matchedItem.id }));
        setBarcodeInput("");
      },
      (msg) => setErrorMessage(msg)
    );
  };

  const handleSafeClose = () => {
    checkDirtyFormClose(isDirty, onClose);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.itemId) {
      setErrorMessage("Выберите номенклатурную позицию для списания");
      return;
    }

    if (!stockValidation.isValid) {
      setErrorMessage(stockValidation.errorMessage || "Ошибка проверки доступного остатка");
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
        setIsDirty(false);
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Ошибка при выполнении списания");
      }
    } catch (err) {
      console.error("Failed to write off WMS item:", err);
      setErrorMessage("Ошибка сети при отправке акта списания");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleSafeClose} size="md">
      <ModalHeader title="Списание ТМЦ / Акт установки в ТОИР" onClose={handleSafeClose} />

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Barcode Scanner Stub Toolbar */}
        <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Barcode size={15} className="text-blue-600" />
            <span>Поиск ТМЦ по ШК (Сканер):</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleBarcodeScanSubmit(e);
              }}
              placeholder="Сканировать..."
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-mono bg-white focus:ring-2 focus:ring-blue-500 w-36"
            />
            <button
              type="button"
              onClick={handleBarcodeScanSubmit}
              className="rounded-lg bg-blue-600 text-white px-2 py-1 text-xs font-semibold hover:bg-blue-700 transition"
            >
              Найти
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Выберите ТМЦ для списания *
          </label>
          <SearchableSelect
            options={safeItems.map((i) => ({
              value: i.id,
              label: `${i.name} (SKU: ${i.sku}) — Склад: ${i.warehouse} [Остаток: ${getAvailableStock(i)} ${i.unit}]`
            }))}
            value={formData.itemId}
            onChange={(val) => updateForm({ itemId: val })}
            placeholder="Поиск номенклатуры..."
          />
          {selectedItem && (
            <div className="mt-1 text-[11px] flex justify-between items-center text-slate-500">
              <span>Закрепленный склад: <strong className="text-slate-800">{selectedItem.warehouse}</strong></span>
              <span>Доступный остаток: <strong className="text-blue-700 font-bold">{availableStock} {selectedItem.unit}</strong></span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Количество к списанию *
            </label>
            <input
              type="number"
              min="1"
              max={availableStock}
              required
              value={formData.quantity}
              onChange={(e) => updateForm({ quantity: parseInt(e.target.value) || 1 })}
              className={`w-full rounded-lg border px-3 py-2 text-xs font-bold ${
                !stockValidation.isValid
                  ? "border-rose-400 text-rose-700 bg-rose-50"
                  : "border-slate-200 text-slate-900 focus:ring-2 focus:ring-blue-500"
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Причина списания</label>
            <select
              value={formData.reason}
              onChange={(e) => updateForm({ reason: e.target.value })}
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
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Оборудование / Агрегат-получатель (EPS)
          </label>
          <SearchableSelect
            options={safeEquipments.map((e) => ({
              value: `${e.name} (${e.equipmentCode})`,
              label: `${e.name} [${e.equipmentCode}]`
            }))}
            value={formData.equipmentName || ""}
            onChange={(val) => updateForm({ equipmentName: val })}
            placeholder="Выберите оборудование для привязки расхода..."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Ответственный (МОЛ)</label>
          <input
            type="text"
            value={formData.performedBy}
            onChange={(e) => updateForm({ performedBy: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Комментарии / Обоснование</label>
          <textarea
            rows={2}
            value={formData.comments || ""}
            onChange={(e) => updateForm({ comments: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            placeholder="Укажите номер наряда-допуска или акт браковки..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSafeClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting || !stockValidation.isValid}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs disabled:opacity-50 transition"
          >
            <FileSpreadsheet size={15} />
            <span>{submitting ? "Списание..." : "Провести списание"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
