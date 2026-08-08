"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader } from "@/components/ui";
import { Plus } from "lucide-react";
import { Warehouse, CreateWmsItemPayload } from "@/types/wms";

interface CreateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  warehouses?: Warehouse[];
}

export function CreateItemModal({
  isOpen,
  onClose,
  onSuccess,
  warehouses = []
}: CreateItemModalProps) {
  const safeWarehouses = warehouses || [];

  const [formData, setFormData] = useState<CreateWmsItemPayload>({
    name: "",
    sku: "",
    category: "Запчасти & Механика",
    type: "ZIP",
    warehouse: "",
    zone: "А1",
    cell: "Яч-01",
    batchNumber: "",
    serialNumber: "",
    quantity: 10,
    minQuantity: 2,
    maxQuantity: 100,
    unit: "шт",
    unitPrice: 1500,
    isEps: false,
    supplier: "",
    description: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (safeWarehouses.length > 0 && !formData.warehouse) {
      setFormData((prev) => ({ ...prev, warehouse: safeWarehouses[0].name }));
    }
  }, [safeWarehouses, formData.warehouse]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku || !formData.warehouse) {
      alert("Заполните наименование, SKU и склад");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при приходе ТМЦ");
      }
    } catch (err) {
      console.error("Failed to create WMS item:", err);
      alert("Ошибка сети при отправке запроса");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader title="Оформление Прихода ТМЦ на Склад" onClose={onClose} />
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Наименование ТМЦ *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="Напр. Подшипник SKF 6204"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Артикул / SKU *
            </label>
            <input
              type="text"
              required
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="SKU-8820"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Категория</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="Запчасти & Механика">Запчасти & Механика</option>
              <option value="Электрооборудование">Электрооборудование</option>
              <option value="Расходные материалы">Расходные материалы</option>
              <option value="СИЗ и Спецодежда">СИЗ и Спецодежда</option>
              <option value="Инструменты">Инструменты</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Тип ТМЦ</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="ZIP">ЗИП (Запчасть)</option>
              <option value="CONSUMABLE">Расходный материал</option>
              <option value="TOOL">Инструмент</option>
              <option value="PPE">СИЗ</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Целевой Склад *</label>
            <select
              value={formData.warehouse}
              onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            >
              {safeWarehouses.map((w) => (
                <option key={w.id} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Зона</label>
              <input
                type="text"
                value={formData.zone || ""}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                placeholder="А1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ячейка</label>
              <input
                type="text"
                value={formData.cell || ""}
                onChange={(e) => setFormData({ ...formData, cell: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                placeholder="Яч-01"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Количество *</label>
            <input
              type="number"
              min="1"
              required
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Единица измерения</label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="шт, м, кг, литр"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Неснижаемый минимум (Min)
            </label>
            <input
              type="number"
              min="0"
              value={formData.minQuantity}
              onChange={(e) =>
                setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 0 })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Цена за ед. (руб)
            </label>
            <input
              type="number"
              min="0"
              value={formData.unitPrice}
              onChange={(e) =>
                setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Номер партии</label>
            <input
              type="text"
              value={formData.batchNumber || ""}
              onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="BATCH-2025-01"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Серийный номер (при наличии)
            </label>
            <input
              type="text"
              value={formData.serialNumber || ""}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="SN-99401"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isEps"
            checked={formData.isEps}
            onChange={(e) => setFormData({ ...formData, isEps: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isEps" className="text-xs font-medium text-slate-700">
            Относится к неснижаемому запасу критического оборудования EPS / ТОИР
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
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} /> {submitting ? "Сохранение..." : "Принять на склад"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
