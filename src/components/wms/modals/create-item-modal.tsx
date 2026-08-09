"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader } from "@/components/ui";
import { Plus, Wand2, Calculator, FileText, Building2, PackageCheck } from "lucide-react";
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

  const [formData, setFormData] = useState<CreateWmsItemPayload & { invoiceNumber?: string; supplier?: string }>({
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
    invoiceNumber: "",
    description: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (safeWarehouses.length > 0 && !formData.warehouse) {
      setFormData((prev) => ({ ...prev, warehouse: safeWarehouses[0].name }));
    }
  }, [safeWarehouses, formData.warehouse]);

  const generateRandomSku = () => {
    const prefix = formData.type === "PPE" ? "PPE" : formData.type === "ZIP" ? "ZIP" : "SKU";
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setFormData((prev) => ({ ...prev, sku: `${prefix}-${randomNum}` }));
  };

  const totalPrice = (formData.quantity || 0) * (formData.unitPrice || 0);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku || !formData.warehouse) {
      alert("Заполните наименование, SKU и целевой склад");
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
        alert(err.error || "Ошибка при оформлении прихода ТМЦ");
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
      <ModalHeader title="Оформление Прихода ТМЦ на Склад (Приемка)" onClose={onClose} />
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Блок первично-учетного документа */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <FileText size={14} className="text-blue-600" />
            <span>Первичные сопроводительные документы</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Поставщик / Контрагент
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.supplier || ""}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="ООО «ПромСнабЗапчасть»"
                />
                <Building2 size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                № Накладной / УПД / Акта
              </label>
              <input
                type="text"
                value={formData.invoiceNumber || ""}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="УПД-2025/8812"
              />
            </div>
          </div>
        </div>

        {/* Номенклатурные данные */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Наименование ТМЦ *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-medium"
              placeholder="Напр. Подшипник SKF 6204-2RSH или Куртка защитная СИЗ"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Артикул / SKU *
              </label>
              <button
                type="button"
                onClick={generateRandomSku}
                className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 transition"
              >
                <Wand2 size={11} /> Сгенерировать
              </button>
            </div>
            <input
              type="text"
              required
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-600"
              placeholder="SKU-8820"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Категория</label>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Тип ТМЦ</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="ZIP">ЗИП (Запчасть)</option>
              <option value="CONSUMABLE">Расходный материал</option>
              <option value="TOOL">Инструмент</option>
              <option value="PPE">СИЗ / Спецодежда</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Целевой Склад *</label>
            <select
              value={formData.warehouse}
              onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-semibold"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Зона топологии</label>
              <input
                type="text"
                value={formData.zone || ""}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                placeholder="А1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ячейка хранения</label>
              <input
                type="text"
                value={formData.cell || ""}
                onChange={(e) => setFormData({ ...formData, cell: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                placeholder="Яч-01"
              />
            </div>
          </div>

          {/* Количественный и финансовый пересчет */}
          <div className="grid grid-cols-3 gap-2 md:col-span-2 rounded-xl bg-blue-50/40 p-3 border border-blue-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Количество прихода *
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-14 rounded-lg border border-slate-200 px-1.5 py-1.5 text-xs text-center font-medium bg-white"
                  placeholder="шт"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Цена за ед. (руб)
              </label>
              <input
                type="number"
                min="0"
                value={formData.unitPrice}
                onChange={(e) =>
                  setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-blue-900 mb-1 flex items-center gap-1">
                <Calculator size={12} /> Итого стоимость:
              </label>
              <div className="w-full rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-extrabold text-blue-700 bg-blue-100/60 flex items-center justify-between">
                <span>{totalPrice.toLocaleString("ru-RU")}</span>
                <span className="text-[10px] text-blue-500 font-bold">РУБ</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">№ Партии</label>
            <input
              type="text"
              value={formData.batchNumber || ""}
              onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="BATCH-2025-01"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Серийный номер (S/N)
            </label>
            <input
              type="text"
              value={formData.serialNumber || ""}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="SN-99401"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="isEps"
            checked={formData.isEps}
            onChange={(e) => setFormData({ ...formData, isEps: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="isEps" className="text-xs font-medium text-slate-700 cursor-pointer">
            Относится к неснижаемому запасу критического оборудования (EPS / ТОиР)
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs disabled:opacity-50 transition"
          >
            <PackageCheck size={15} />
            <span>{submitting ? "Приемка..." : "Принять и оприходовать"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
