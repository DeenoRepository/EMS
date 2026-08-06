"use client";

import React, { useState } from "react";
import { X, Save, Plus, Trash2, Box, QrCode } from "lucide-react";
import { WmsItem } from "@/lib/modules/wms-store";

interface WmsItemFormProps {
  initialData?: Partial<WmsItem>;
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (item: WmsItem) => void;
}

export default function WmsItemForm({ initialData, isOpen, onClose, onSubmitSuccess }: WmsItemFormProps) {
  const [sku, setSku] = useState(initialData?.sku || "");
  const [name, setName] = useState(initialData?.name || "");
  const [category, setCategory] = useState(initialData?.category || "Подшипники");
  const [type, setType] = useState<WmsItem["type"]>(initialData?.type || "ZIP");
  const [unit, setUnit] = useState<WmsItem["unit"]>(initialData?.unit || "pcs");
  const [warehouse, setWarehouse] = useState(initialData?.warehouse || "Основной склад ЗИП");
  const [cell, setCell] = useState(initialData?.cell || "");
  const [quantity, setQuantity] = useState<number>(initialData?.quantity || 0);
  const [minQuantity, setMinQuantity] = useState<number>(initialData?.minQuantity || 5);
  const [maxQuantity, setMaxQuantity] = useState<number>(initialData?.maxQuantity || 50);
  const [reservedQuantity, setReservedQuantity] = useState<number>(initialData?.reservedQuantity || 0);
  const [unitPrice, setUnitPrice] = useState<number>(initialData?.unitPrice || 0);
  const [supplier, setSupplier] = useState(initialData?.supplier || "");
  const [responsibleUser, setResponsibleUser] = useState(initialData?.responsibleUser || "Смирнов А.В. (Старший кладовщик)");
  const [description, setDescription] = useState(initialData?.description || "");
  const [barcode, setBarcode] = useState(initialData?.barcode || "");
  const [compatibleEq, setCompatibleEq] = useState<string>((initialData?.compatibleEquipment || []).join(", "));
  
  const [specs, setSpecs] = useState<Array<{ key: string; value: string }>>(() => {
    if (initialData?.techSpecs) {
      return Object.entries(initialData.techSpecs).map(([key, value]) => ({ key, value }));
    }
    return [{ key: "материал", value: "" }, { key: "размер", value: "" }];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddSpec = () => {
    setSpecs((prev) => [...prev, { key: "", value: "" }]);
  };

  const handleRemoveSpec = (index: number) => {
    setSpecs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSpecChange = (index: number, field: "key" | "value", val: string) => {
    setSpecs((prev) => {
      const updated = [...prev];
      updated[index][field] = val;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Укажите наименование позиций ТМЦ/ЗИП");
      return;
    }

    setLoading(true);
    setError(null);

    const techSpecsObj: Record<string, string> = {};
    specs.forEach((s) => {
      if (s.key.trim() && s.value.trim()) {
        techSpecsObj[s.key.trim()] = s.value.trim();
      }
    });

    const payload = {
      sku: sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      name: name.trim(),
      category,
      type,
      unit,
      warehouse,
      cell: cell.trim() || "Не указана",
      quantity: Number(quantity) || 0,
      minQuantity: Number(minQuantity) || 0,
      maxQuantity: Number(maxQuantity) || 0,
      reservedQuantity: Number(reservedQuantity) || 0,
      unitPrice: Number(unitPrice) || 0,
      supplier: supplier.trim(),
      responsibleUser: responsibleUser.trim(),
      description: description.trim(),
      barcode: barcode.trim() || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
      compatibleEquipment: compatibleEq.split(",").map((s) => s.trim()).filter(Boolean),
      techSpecs: techSpecsObj
    };

    try {
      const res = await fetch("/api/modules/wms/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Ошибка при сохранении позиции ТМЦ");

      const data = await res.json();
      onSubmitSuccess(data.item);
      onClose();
    } catch (err: any) {
      setError(err.message || "Не удалось сохранить ТМЦ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Box size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#17243a]">
                {initialData?.id ? "Редактирование карточки ТМЦ / ЗИП" : "Создание новой карточки ТМЦ / ЗИП"}
              </h2>
              <p className="text-xs text-slate-500">Заполните складские реквизиты, нормативы и технические характеристики</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Section 1: Main details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50/70 px-3 py-1.5 rounded-md inline-block">
              1. Идентификация и классификация ТМЦ
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Артикул / SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="SKU-BRG-6204-RS"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Наименование ТМЦ / ЗИП <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Подшипник шариковый радиальный 6204-2RS SKF"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Категория запасов</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                >
                  <option value="Подшипники">Подшипники</option>
                  <option value="Смазочные материалы">Смазочные материалы</option>
                  <option value="Гидравлика">Гидравлика</option>
                  <option value="Электроника">Электроника</option>
                  <option value="Расходные элементы">Расходные элементы</option>
                  <option value="Инструмент">Инструмент</option>
                  <option value="Метизы">Метизы</option>
                  <option value="Спецодежда и СИЗ">Спецодежда и СИЗ</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Тип ТМЦ</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                >
                  <option value="ZIP">ЗИП (Запасные части)</option>
                  <option value="CONSUMABLE">Расходные материалы</option>
                  <option value="TOOL">Инструмент & Оснастка</option>
                  <option value="EQUIPMENT_PART">Узлы и агрегаты</option>
                  <option value="PPE">СИЗ & Спецодежда</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Единица измерения</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                >
                  <option value="pcs">Штуки (шт)</option>
                  <option value="kg">Килограммы (кг)</option>
                  <option value="l">Литры (л)</option>
                  <option value="m">Метры (м)</option>
                  <option value="set">Комплекты (компл)</option>
                  <option value="box">Упаковки (упак)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Storage & Quantity */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50/70 px-3 py-1.5 rounded-md inline-block">
              2. Складское размещение и Нормативы остатков
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Склад хранения</label>
                <select
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                >
                  <option value="Основной склад ЗИП">Основной склад ЗИП</option>
                  <option value="Склад ГСМ №2">Склад ГСМ №2</option>
                  <option value="Цеховая кладовая №3">Цеховая кладовая №3</option>
                  <option value="Склад Инструмента">Склад Инструмента</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Точная ячейка / Место хранения</label>
                <input
                  type="text"
                  value={cell}
                  onChange={(e) => setCell(e.target.value)}
                  placeholder="Стеллаж A-04 / Ячейка 12"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Факт. остаток</label>
                <input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Мин. остаток</label>
                <input
                  type="number"
                  min="0"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Макс. норма</label>
                <input
                  type="number"
                  min="0"
                  value={maxQuantity}
                  onChange={(e) => setMaxQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Резерв</label>
                <input
                  type="number"
                  min="0"
                  value={reservedQuantity}
                  onChange={(e) => setReservedQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Цена ед. (руб)</label>
                <input
                  type="number"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Integration & Supplier */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50/70 px-3 py-1.5 rounded-md inline-block">
              3. Совместимость EPS и Поставщики
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Совместимое оборудование EPS (через запятую)</label>
                <input
                  type="text"
                  value={compatibleEq}
                  onChange={(e) => setCompatibleEq(e.target.value)}
                  placeholder="EQ-CNC-2026-01, EQ-PRESS-2026-04"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Поставщик / Изготовитель</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="ООО СпецПодшипник Торг"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Specifications */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50/70 px-3 py-1.5 rounded-md inline-block">
                4. Технические характеристики
              </h3>
              <button
                type="button"
                onClick={handleAddSpec}
                className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-700"
              >
                <Plus size={13} /> Добавить параметр
              </button>
            </div>

            <div className="space-y-2">
              {specs.map((s, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Название (напр. Внутренний диаметр)"
                    value={s.key}
                    onChange={(e) => handleSpecChange(idx, "key", e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Значение (напр. 20 мм)"
                    value={s.value}
                    onChange={(e) => handleSpecChange(idx, "value", e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSpec(idx)}
                    className="p-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-purple-200 hover:bg-purple-700 disabled:opacity-50"
            >
              <Save size={14} />
              {loading ? "Сохранение..." : "Сохранить карточку ТМЦ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
