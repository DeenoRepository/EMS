"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader, SearchableSelect } from "@/components/ui";
import { UserCheck } from "lucide-react";
import { WmsItem, WmsEmployee } from "@/types/wms";

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
  const [formData, setFormData] = useState({
    selectedEmployeeId: "",
    employeeName: "",
    employeePosition: "Инженер-механик",
    employeeNumber: "Т-0482",
    department: "Цех №1",
    itemId: defaultItemId || (items[0]?.id || ""),
    quantity: 1,
    notes: "Выдача по нормам СИЗ",
    saveToRoster: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        itemId: defaultItemId || prev.itemId || (items[0]?.id || "")
      }));
    }
  }, [isOpen, defaultItemId, items]);

  // When selecting an employee from the dropdown, autofill details
  const handleEmployeeSelect = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeName || !formData.itemId || formData.quantity <= 0) {
      alert("Заполните ФИО сотрудника, позицию ТМЦ и количество");
      return;
    }

    const selectedItem = items.find((i) => i.id === formData.itemId);
    if (!selectedItem) {
      alert("Выбранный товар не найден в каталоге");
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
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при выдаче имущественного СИЗ/Инструмента");
      }
    } catch (err) {
      console.error("Failed to issue personal card:", err);
      alert("Ошибка сети при выдаче в личную карточку");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedItem = items.find((i) => i.id === formData.itemId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader title="Выдача СИЗ / Инструмента в личную карточку" onClose={onClose} />
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {employees.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Быстрый выбор из справочника сотрудников
            </label>
            <SearchableSelect
              options={employees.map((emp) => ({
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
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ФИО Сотрудника *
            </label>
            <input
              type="text"
              required
              value={formData.employeeName}
              onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="Иванов И.И."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Табельный номер
            </label>
            <input
              type="text"
              value={formData.employeeNumber}
              onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Т-0482"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Должность</label>
            <input
              type="text"
              value={formData.employeePosition}
              onChange={(e) => setFormData({ ...formData, employeePosition: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="Слесарь-ремонтник"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Подразделение</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="Цех №1"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Выдаваемое имущество / СИЗ / Инструмент *
          </label>
          <SearchableSelect
            options={items.map((i) => ({
              value: i.id,
              label: `${i.name} (SKU: ${i.sku}) — Доступно: ${i.quantity} ${i.unit}`
            }))}
            value={formData.itemId}
            onChange={(val) => setFormData({ ...formData, itemId: val })}
            placeholder="Выберите номенклатуру..."
          />
          {selectedItem && (
            <div className="mt-1 text-[11px] text-slate-500">
              Остаток на складе:{" "}
              <span className="font-bold text-slate-700">
                {selectedItem.quantity} {selectedItem.unit}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Количество выдачи *
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
            <label className="block text-xs font-medium text-slate-700 mb-1">Примечание</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="Выдача по плановой норме..."
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="saveToRoster"
            checked={formData.saveToRoster}
            onChange={(e) => setFormData({ ...formData, saveToRoster: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="saveToRoster" className="text-xs text-slate-600">
            Сохранить/обновить данные сотрудника в общем реестре персонала
          </label>
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
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <UserCheck size={14} /> {submitting ? "Выдача..." : "Выдать в личную карточку"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
