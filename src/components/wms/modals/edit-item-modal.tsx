"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader } from "@/components/ui";
import { Pencil, Layers, MapPin, Box, DollarSign, AlertCircle } from "lucide-react";
import { WmsItem, Warehouse } from "@/types/wms";
import { getZonesForWarehouse, getCellsForZone, checkDirtyFormClose } from "./wms-modal-utils";

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: WmsItem | null;
  warehouses: Warehouse[];
}

type TabType = "general" | "topology" | "inventory" | "financial";

export function EditItemModal({
  isOpen,
  onClose,
  onSuccess,
  item,
  warehouses = []
}: EditItemModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [isDirty, setIsDirty] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "Запчасти & Механика",
    type: "ZIP",
    warehouse: "",
    zone: "",
    cell: "",
    quantity: 0,
    minQuantity: 0,
    maxQuantity: 100,
    unit: "шт",
    unitPrice: 0,
    isEps: false,
    supplier: "",
    batchNumber: "",
    serialNumber: "",
    description: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (item && isOpen) {
      setIsDirty(false);
      setErrorMessage(null);
      setActiveTab("general");
      setFormData({
        name: item.name || "",
        sku: item.sku || "",
        category: item.category || "Запчасти & Механика",
        type: item.type || "ZIP",
        warehouse: item.warehouse || "",
        zone: item.zone || "",
        cell: item.cell || "",
        quantity: item.quantity || 0,
        minQuantity: item.minQuantity || 0,
        maxQuantity: item.maxQuantity || 100,
        unit: item.unit || "шт",
        unitPrice: item.unitPrice || 0,
        isEps: !!item.isEps,
        supplier: item.supplier || "",
        batchNumber: item.batchNumber || "",
        serialNumber: item.serialNumber || "",
        description: item.description || ""
      });
    }
  }, [item, isOpen]);

  const handleWarehouseChange = (whName: string) => {
    setIsDirty(true);
    const zones = getZonesForWarehouse(whName, warehouses);
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

  const updateForm = (fields: Partial<typeof formData>) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleSafeClose = () => {
    checkDirtyFormClose(isDirty, onClose);
  };

  if (!isOpen || !item) return null;

  const availableZones = getZonesForWarehouse(formData.warehouse, warehouses);
  const availableCells = getCellsForZone(formData.zone);
  const totalPrice = (formData.quantity || 0) * (formData.unitPrice || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim()) {
      setActiveTab("general");
      setErrorMessage("Наименование ТМЦ не может быть пустым");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/modules/wms/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsDirty(false);
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Ошибка сохранения карточки ТМЦ");
      }
    } catch (err) {
      console.error("Failed to edit WMS item:", err);
      setErrorMessage("Ошибка сети при сохранении изменений");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleSafeClose} size="lg">
      <ModalHeader title={`Редактирование ТМЦ: ${item.name}`} onClose={handleSafeClose} />

      {/* Tabs */}
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
          <span>1. Основное</span>
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
          <span>2. Топология</span>
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
          <span>3. Учет и Лимиты</span>
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
          <span>4. Поставщик & Описание</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab 1: General */}
        {activeTab === "general" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Наименование ТМЦ *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Артикул / SKU *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => updateForm({ sku: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-600"
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
                <option value="PPE">СИЗ</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-3 md:col-span-2">
              <input
                type="checkbox"
                id="editIsEps"
                checked={formData.isEps}
                onChange={(e) => updateForm({ isEps: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="editIsEps" className="text-xs font-medium text-slate-700 cursor-pointer">
                Критический неснижаемый запас (EPS / ТОиР)
              </label>
            </div>
          </div>
        )}

        {/* Tab 2: Topology */}
        {activeTab === "topology" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Закрепленный Склад</label>
              <select
                value={formData.warehouse}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Зона топологии</label>
              <select
                value={formData.zone}
                onChange={(e) => handleZoneChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              >
                {availableZones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ячейка хранения</label>
              <select
                value={formData.cell}
                onChange={(e) => updateForm({ cell: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-700"
              >
                {availableCells.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tab 3: Inventory */}
        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Текущий остаток</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => updateForm({ quantity: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ед. изм.</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => updateForm({ unit: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-center font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Мин. порог</label>
                <input
                  type="number"
                  value={formData.minQuantity}
                  onChange={(e) => updateForm({ minQuantity: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Макс. лимит</label>
                <input
                  type="number"
                  value={formData.maxQuantity}
                  onChange={(e) => updateForm({ maxQuantity: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">№ Партии</label>
              <input
                type="text"
                value={formData.batchNumber}
                onChange={(e) => updateForm({ batchNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Серийный номер</label>
              <input
                type="text"
                value={formData.serialNumber}
                onChange={(e) => updateForm({ serialNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
        )}

        {/* Tab 4: Financial & Supplier */}
        {activeTab === "financial" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Цена за ед. (₽)</label>
              <input
                type="number"
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) => updateForm({ unitPrice: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Поставщик</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => updateForm({ supplier: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                placeholder="ООО ПромЗапчасть"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Описание / Заметки</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Footer */}
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
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs disabled:opacity-50 transition"
          >
            <Pencil size={14} />
            <span>{submitting ? "Сохранение..." : "Сохранить изменения"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
