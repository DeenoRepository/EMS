"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader, SearchableSelect } from "@/components/ui";
import { UserCheck, AlertCircle, Barcode } from "lucide-react";
import { WmsItem, WmsEmployee } from "@/types/wms";
import { getAvailableStock, validateStockLimit, scanBarcodeStub, checkDirtyFormClose } from "./wms-modal-utils";

interface PersonalCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  items: WmsItem[];
  employees: WmsEmployee[];
  defaultItemId?: string;
}

export function PersonalCardModal({
  isOpen,
  onClose,
  onSuccess,
  items,
  employees,
  defaultItemId
}: PersonalCardModalProps) {
  const safeItems = items || [];
  const safeEmployees = employees || [];

  const [isDirty, setIsDirty] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    selectedEmployeeId: "",
    employeeName: "",
    employeePosition: "Инженер-механик",
    employeeNumber: "Т-0482",
    department: "Цех №1",
    itemId: defaultItemId || (safeItems[0]?.id || ""),
    quantity: 1,
    notes: "Выдача по нормам СИЗ",
    saveToRoster: true
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

  const updateForm = (fields: Partial<typeof formData>) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleEmployeeSelect = (empId: string) => {
    setIsDirty(true);
    const emp = safeEmployees.find((e) => e.id === empId);
    if (emp) {
      setFormData((prev) => ({
        ...prev,
        selectedEmployeeId: emp.id,
        employeeName: emp.name,
        employeeNumber: emp.employeeNumber,
        employeePosition: emp.position || prev.employeePosition,
        department: emp.department || prev.department
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        selectedEmployeeId: empId
      }));
    }
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

  if (!isOpen) return null;

  const selectedItem = safeItems.find((i) => i.id === formData.itemId);
  const availableStock = getAvailableStock(selectedItem);
  const stockValidation = validateStockLimit(formData.quantity, availableStock);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.employeeName || !formData.itemId) {
      setErrorMessage("Заполните ФИО сотрудника и выберите позицию ТМЦ");
      return;
    }

    if (!stockValidation.isValid) {
      setErrorMessage(stockValidation.errorMessage || "Недостаточно остатков на складе для выдачи");
      return;
    }

    if (!selectedItem) {
      setErrorMessage("Выбранная позиция ТМЦ не найдена");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/personal-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItem.id,
          itemSku: selectedItem.sku,
          itemName: selectedItem.name,
          employeeName: formData.employeeName,
          employeePosition: formData.employeePosition,
          employeeNumber: formData.employeeNumber,
          department: formData.department,
          issuedQuantity: formData.quantity,
          notes: formData.notes,
          saveToRoster: formData.saveToRoster
        })
      });

      if (res.ok) {
        setIsDirty(false);
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Ошибка при выдаче имущественного СИЗ/Инструмента");
      }
    } catch (err) {
      console.error("Failed to issue personal card:", err);
      setErrorMessage("Ошибка сети при выдаче в личную карточку");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleSafeClose} size="lg">
      <ModalHeader title="Выдача СИЗ / Инструмента в личную карточку" onClose={handleSafeClose} />

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Barcode scanner stub */}
        <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Barcode size={15} className="text-blue-600" />
            <span>Поиск СИЗ по ШК (Сканер):</span>
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

        {safeEmployees.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Быстрый выбор из справочника сотрудников
            </label>
            <SearchableSelect
              options={safeEmployees.map((emp) => ({
                value: emp.id,
                label: `${emp.name} (Таб. №${emp.employeeNumber}) — ${emp.position || "Сотрудник"} [${emp.department || "Без отдела"}]`
              }))}
              value={formData.selectedEmployeeId}
              onChange={handleEmployeeSelect}
              placeholder="Поиск сотрудника по ФИО или табельному номеру..."
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ФИО Сотрудника *
            </label>
            <input
              type="text"
              required
              value={formData.employeeName}
              onChange={(e) => updateForm({ employeeName: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-medium"
              placeholder="Иванов И.И."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Табельный номер
            </label>
            <input
              type="text"
              value={formData.employeeNumber}
              onChange={(e) => updateForm({ employeeNumber: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Должность</label>
            <input
              type="text"
              value={formData.employeePosition}
              onChange={(e) => updateForm({ employeePosition: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Подразделение / Цех</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => updateForm({ department: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Выдаваемое ТМЦ *</label>
            <SearchableSelect
              options={safeItems.map((i) => ({
                value: i.id,
                label: `${i.name} (SKU: ${i.sku}) — Склад: ${i.warehouse} [Доступно: ${getAvailableStock(i)} ${i.unit}]`
              }))}
              value={formData.itemId}
              onChange={(val) => updateForm({ itemId: val })}
              placeholder="Поиск имущества..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Количество к выдаче *</label>
              <span className="text-[10px] text-slate-500 font-bold">Остаток: {availableStock} шт.</span>
            </div>
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
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Основание / Примечания</label>
          <textarea
            rows={2}
            value={formData.notes}
            onChange={(e) => updateForm({ notes: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="saveToRoster"
            checked={formData.saveToRoster}
            onChange={(e) => updateForm({ saveToRoster: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="saveToRoster" className="text-xs font-medium text-slate-700 cursor-pointer">
            Запомнить сотрудника в справочнике предприятия
          </label>
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
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs disabled:opacity-50 transition"
          >
            <UserCheck size={15} />
            <span>{submitting ? "Оформление..." : "Оформить выдачу"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
