"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader } from "@/components/ui";
import { Wand2, PackageCheck, Layers, MapPin, Box, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";
import { Warehouse, CreateWmsItemPayload } from "@/types/wms";
import { getZonesForWarehouse, getCellsForZone, checkDirtyFormClose } from "./wms-modal-utils";

interface CreateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  warehouses?: Warehouse[];
}

type TabType = "general" | "topology" | "inventory" | "financial";

export function CreateItemModal({
  isOpen,
  onClose,
  onSuccess,
  warehouses = []
}: CreateItemModalProps) {
  const safeWarehouses = warehouses || [];

  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [isDirty, setIsDirty] = useState(false);

  const [formData, setFormData] = useState<CreateWmsItemPayload>({
    name: "",
    sku: "",
    category: "Запчасти & Механика",
    type: "ZIP",
    warehouse: "",
    zone: "Зона А (Основная)",
    cell: "Яч-A1-01",
    batchNumber: "",
    serialNumber: "",
    quantity: 10,
    minQuantity: 2,
    maxQuantity: 100,
    unit: "шт",
    unitPrice: 0,
    isEps: false,
    description: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize initial warehouse and topology options
  useEffect(() => {
    if (isOpen) {
      setIsDirty(false);
      setErrorMessage(null);
      setActiveTab("general");
      if (safeWarehouses.length > 0 && !formData.warehouse) {
        const initialWh = safeWarehouses[0].name;
        const availableZones = getZonesForWarehouse(initialWh, safeWarehouses);
        const initialZone = availableZones[0] || "Зона А (Основная)";
        const availableCells = getCellsForZone(initialZone);
        setFormData((prev) => ({
          ...prev,
          warehouse: initialWh,
          zone: initialZone,
          cell: availableCells[0] || "Яч-01"
        }));
      }
    }
  }, [isOpen, safeWarehouses]);

  // Handle cascading topology changes
  const handleWarehouseChange = (whName: string) => {
    setIsDirty(true);
    const zones = getZonesForWarehouse(whName, safeWarehouses);
    const nextZone = zones[0] || "Зона А";
    const cells = getCellsForZone(nextZone);
    setFormData((prev) => ({
      ...prev,
      warehouse: whName,
      zone: nextZone,
      cell: cells[0] || "Яч-01"
    }));
  };

  const handleZoneChange = (zoneName: string) => {
    setIsDirty(true);
    const cells = getCellsForZone(zoneName);
    setFormData((prev) => ({
      ...prev,
      zone: zoneName,
      cell: cells[0] || "Яч-01"
    }));
  };

  const updateForm = (fields: Partial<CreateWmsItemPayload>) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const generateRandomSku = () => {
    setIsDirty(true);
    const prefix = formData.type === "PPE" ? "PPE" : formData.type === "ZIP" ? "ZIP" : "SKU";
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setFormData((prev) => ({ ...prev, sku: `${prefix}-${randomNum}` }));
  };

  const handleSafeClose = () => {
    checkDirtyFormClose(isDirty, onClose);
  };

  if (!isOpen) return null;

  const availableZones = getZonesForWarehouse(formData.warehouse, safeWarehouses);
  const availableCells = getCellsForZone(formData.zone || "");
  const totalPrice = (formData.quantity || 0) * (formData.unitPrice || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim()) {
      setActiveTab("general");
      setErrorMessage("Укажите наименование ТМЦ");
      return;
    }
    if (!formData.sku.trim()) {
      setActiveTab("general");
      setErrorMessage("Укажите или сгенерируйте SKU");
      return;
    }
    if (!formData.warehouse) {
      setActiveTab("topology");
      setErrorMessage("Выберите целевой склад для оприходования");
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
        setIsDirty(false);
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Ошибка при оформлении прихода ТМЦ");
      }
    } catch (err) {
      console.error("Failed to create WMS item:", err);
      setErrorMessage("Ошибка сети при отправке запроса");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleSafeClose} size="lg">
      <ModalHeader title="Оформление Прихода ТМЦ (Приемка на Склад)" onClose={handleSafeClose} />
      
      {/* Visual Tabs Navigation */}
      <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-1.5 py-3 px-4 text-xs font-semibold border-b-2 transition ${
            activeTab === "general"
              ? "border-blue-600 text-blue-600 bg-white shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Layers size={14} />
          <span>1. Основные данные</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("topology")}
          className={`flex items-center gap-1.5 py-3 px-4 text-xs font-semibold border-b-2 transition ${
            activeTab === "topology"
              ? "border-blue-600 text-blue-600 bg-white shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <MapPin size={14} />
          <span>2. Топология хранения</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={`flex items-center gap-1.5 py-3 px-4 text-xs font-semibold border-b-2 transition ${
            activeTab === "inventory"
              ? "border-blue-600 text-blue-600 bg-white shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Box size={14} />
          <span>3. Учет и Партии</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("financial")}
          className={`flex items-center gap-1.5 py-3 px-4 text-xs font-semibold border-b-2 transition ${
            activeTab === "financial"
              ? "border-blue-600 text-blue-600 bg-white shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <DollarSign size={14} />
          <span>4. Стоимость и Описание</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab 1: General Info */}
        {activeTab === "general" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Наименование ТМЦ *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => updateForm({ name: e.target.value })}
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
                onChange={(e) => updateForm({ sku: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-600"
                placeholder="SKU-8820"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Категория</label>
              <select
                value={formData.category}
                onChange={(e) => updateForm({ category: e.target.value })}
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
                onChange={(e) => updateForm({ type: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="ZIP">ЗИП (Запчасть)</option>
                <option value="CONSUMABLE">Расходный материал</option>
                <option value="TOOL">Инструмент</option>
                <option value="PPE">СИЗ / Спецодежда</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-4 md:col-span-2">
              <input
                type="checkbox"
                id="isEps"
                checked={formData.isEps}
                onChange={(e) => updateForm({ isEps: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="isEps" className="text-xs font-medium text-slate-700 cursor-pointer">
                Относится к неснижаемому запасу критического оборудования (EPS / ТОиР)
              </label>
            </div>
          </div>
        )}

        {/* Tab 2: Topology */}
        {activeTab === "topology" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Закрепленный Склад (МОЛ) *
              </label>
              <select
                value={formData.warehouse}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-semibold bg-white"
              >
                {safeWarehouses.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Зона топологии *
              </label>
              <select
                value={formData.zone || ""}
                onChange={(e) => handleZoneChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {availableZones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ячейка хранения *
              </label>
              <select
                value={formData.cell || ""}
                onChange={(e) => updateForm({ cell: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-700 bg-white"
              >
                {availableCells.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 rounded-xl bg-blue-50/50 p-4 border border-blue-100 flex items-start gap-3 mt-2">
              <MapPin size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 leading-relaxed">
                <span className="font-bold text-slate-900">Адресация топологии: </span>
                Оприходование позиций с указанием точной зоны и ячейки позволяет отслеживать точное размещение в WMS и исключает пересортицу при сборке заказов.
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Inventory & Quantities */}
        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 md:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Количество прихода *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={(e) => updateForm({ quantity: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => updateForm({ unit: e.target.value })}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-xs text-center font-bold bg-white"
                  placeholder="шт"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Минимальный остаток (Мин)</label>
              <input
                type="number"
                min="0"
                value={formData.minQuantity}
                onChange={(e) => updateForm({ minQuantity: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Максимальный лимит (Макс)</label>
              <input
                type="number"
                min="1"
                value={formData.maxQuantity}
                onChange={(e) => updateForm({ maxQuantity: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">№ Партии</label>
              <input
                type="text"
                value={formData.batchNumber || ""}
                onChange={(e) => updateForm({ batchNumber: e.target.value })}
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
                onChange={(e) => updateForm({ serialNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="SN-99401"
              />
            </div>
          </div>
        )}

        {/* Tab 4: Financial & Description */}
        {activeTab === "financial" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Цена за единицу (₽)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) => updateForm({ unitPrice: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Общая стоимость партии
              </label>
              <div className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50/50 flex items-center justify-between">
                <span>{totalPrice.toLocaleString("ru-RU")} ₽</span>
                <span className="text-[10px] font-normal text-slate-500">
                  ({formData.quantity} {formData.unit} × {formData.unitPrice} ₽)
                </span>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Примечание / Описание ТМЦ
              </label>
              <textarea
                rows={3}
                value={formData.description || ""}
                onChange={(e) => updateForm({ description: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                placeholder="Дополнительные свойства, условия хранения или данные поставщика..."
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex gap-1">
            {activeTab !== "general" && (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === "topology") setActiveTab("general");
                  if (activeTab === "inventory") setActiveTab("topology");
                  if (activeTab === "financial") setActiveTab("inventory");
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Назад
              </button>
            )}
            {activeTab !== "financial" && (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === "general") setActiveTab("topology");
                  if (activeTab === "topology") setActiveTab("inventory");
                  if (activeTab === "inventory") setActiveTab("financial");
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
              >
                Далее
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSafeClose}
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
        </div>
      </form>
    </Modal>
  );
}
