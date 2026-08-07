"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Plus, Trash2, Box, QrCode, ShieldAlert } from "lucide-react";
import { WmsItem, WAREHOUSES_REGISTRY, getWarehouseResponsibleUser, canUserManageItem } from "@/lib/modules/wms-store";
import { useShell } from "@/components/layout/shell-context";

interface WmsItemFormProps {
  initialData?: Partial<WmsItem>;
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (item: WmsItem) => void;
  existingItems?: WmsItem[];
}

export default function WmsItemForm({ initialData, isOpen, onClose, onSubmitSuccess, existingItems = [] }: WmsItemFormProps) {
  const { currentUser } = useShell();

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
  const [responsibleUser, setResponsibleUser] = useState(
    initialData?.responsibleUser || getWarehouseResponsibleUser(initialData?.warehouse || "Основной склад ЗИП")
  );
  const [description, setDescription] = useState(initialData?.description || "");
  const [barcode, setBarcode] = useState(initialData?.barcode || "");
  const [compatibleEq, setCompatibleEq] = useState<string>((initialData?.compatibleEquipment || []).join(", "));

  // Состояние выпадающего списка автокомплита
  const [matchingSuggestions, setMatchingSuggestions] = useState<WmsItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  // Синхронизация полей при переданных начальных данных
  useEffect(() => {
    if (initialData) {
      if (initialData.sku !== undefined) setSku(initialData.sku);
      if (initialData.name !== undefined) setName(initialData.name);
      if (initialData.category !== undefined) setCategory(initialData.category);
      if (initialData.type !== undefined) setType(initialData.type);
      if (initialData.unit !== undefined) setUnit(initialData.unit);
      if (initialData.warehouse !== undefined) setWarehouse(initialData.warehouse);
      if (initialData.cell !== undefined) setCell(initialData.cell);
      if (initialData.quantity !== undefined) setQuantity(initialData.quantity);
      if (initialData.minQuantity !== undefined) setMinQuantity(initialData.minQuantity);
      if (initialData.maxQuantity !== undefined) setMaxQuantity(initialData.maxQuantity);
      if (initialData.reservedQuantity !== undefined) setReservedQuantity(initialData.reservedQuantity);
      if (initialData.unitPrice !== undefined) setUnitPrice(initialData.unitPrice);
      if (initialData.supplier !== undefined) setSupplier(initialData.supplier);
      if (initialData.responsibleUser !== undefined) setResponsibleUser(initialData.responsibleUser);
      if (initialData.description !== undefined) setDescription(initialData.description);
      if (initialData.barcode !== undefined) setBarcode(initialData.barcode);
      if (initialData.compatibleEquipment !== undefined) setCompatibleEq(initialData.compatibleEquipment.join(", "));
    }
  }, [initialData]);

  // Функция авто-подстановки данных из выбранной существующей номенклатуры
  const applyExistingItem = (item: WmsItem) => {
    setSku(item.sku);
    setName(item.name);
    setCategory(item.category);
    setType(item.type);
    setUnit(item.unit);
    setWarehouse(item.warehouse);
    setCell(item.cell);
    setMinQuantity(item.minQuantity);
    setMaxQuantity(item.maxQuantity);
    setUnitPrice(item.unitPrice);
    if (item.supplier) setSupplier(item.supplier);
    if (item.responsibleUser) setResponsibleUser(item.responsibleUser);
    if (item.description) setDescription(item.description);
    if (item.barcode) setBarcode(item.barcode);
    if (item.compatibleEquipment) setCompatibleEq(item.compatibleEquipment.join(", "));
    if (item.techSpecs) {
      setSpecs(Object.entries(item.techSpecs).map(([key, value]) => ({ key, value })));
    }
    setShowDropdown(false);
    setShowSuggestionModal(false);
  };

  // Поиск совпадений по артикулу, наименованию или штрихкоду
  const handleCheckExisting = (queryVal: string, isNameField = false) => {
    if (isNameField) setName(queryVal);
    else setSku(queryVal);

    const q = queryVal.trim().toLowerCase();
    if (q.length < 2 || existingItems.length === 0) {
      setMatchingSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const matches = existingItems.filter(
      (item) =>
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.barcode && item.barcode.includes(q))
    );

    setMatchingSuggestions(matches);
    setShowDropdown(matches.length > 0);
  };

  // При смене склада автоматически обновляем назначенного МОЛ
  const handleWarehouseChange = (newWarehouse: string) => {
    setWarehouse(newWarehouse);
    const defaultMol = getWarehouseResponsibleUser(newWarehouse);
    setResponsibleUser(defaultMol);
  };
  
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

    // Проверка прав доступа МОЛ для склада
    if (!canUserManageItem(currentUser, warehouse)) {
      const respUser = getWarehouseResponsibleUser(warehouse);
      setError(`Отказ в доступе! Вы не являетесь МОЛ склада "${warehouse}". Ответственное лицо: ${respUser}`);
      return;
    }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#3473d4]">
              <Box size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#17243a]">
                {initialData?.id ? "Редактирование карточки ТМЦ / ЗИП" : "Создание новой карточки ТМЦ / ЗИП"}
              </h3>
              <p className="text-[10px] text-slate-400">Заполните складские реквизиты, нормативы и технические характеристики</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0 space-y-4 text-xs pr-1">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-medium text-red-600">
              {error}
            </div>
          )}


          {/* Section 1: Main details */}
          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
            <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-[#3473d4] border-b border-slate-200/60 pb-2">
              <Box size={14} />
              1. Идентификация и классификация ТМЦ
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">
                  Артикул / SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => handleCheckExisting(e.target.value, false)}
                  placeholder="SKU-BRG-6204-RS"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-mono font-bold text-[#3473d4] focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="md:col-span-2 relative">
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">
                  Наименование ТМЦ / ЗИП <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleCheckExisting(e.target.value, true)}
                  onFocus={() => {
                    if (matchingSuggestions.length > 0) setShowDropdown(true);
                  }}
                  placeholder="Подшипник шариковый радиальный 6204-2RS SKF"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-[#17243a] focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />

                {/* Inline Autocomplete Dropdown List */}
                {showDropdown && matchingSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl space-y-1">
                    <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-100 uppercase tracking-wider">
                      <span>Найдено совпадений: {matchingSuggestions.length}</span>
                      <button
                        type="button"
                        onClick={() => setShowDropdown(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        Закрыть ✕
                      </button>
                    </div>
                    {matchingSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => applyExistingItem(item)}
                        className="w-full text-left flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-blue-50 transition border border-transparent hover:border-blue-100"
                      >
                        <div className="space-y-0.5 truncate">
                          <div className="font-bold text-[#17243a] text-[11px] truncate">{item.name}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                            <span className="font-bold text-[#3473d4]">{item.sku}</span>
                            <span>•</span>
                            <span>{item.warehouse} ({item.cell})</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 text-[10px]">
                          <span className="font-bold text-[#17243a] block">{item.quantity} {item.unit}</span>
                          <span className="text-blue-600 font-semibold">Выбрать →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">Категория запасов</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
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
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">Тип ТМЦ</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
                >
                  <option value="ZIP">ЗИП (Запасные части)</option>
                  <option value="CONSUMABLE">Расходные материалы</option>
                  <option value="TOOL">Инструмент & Оснастка</option>
                  <option value="EQUIPMENT_PART">Узлы и агрегаты</option>
                  <option value="PPE">СИЗ & Спецодежда</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">Единица измерения</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
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
          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
            <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-[#3473d4] border-b border-slate-200/60 pb-2">
              <Box size={14} />
              2. Складское размещение и Нормативы остатков
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">
                  Склад хранения (выберите или укажите новый)
                </label>
                <div className="space-y-1.5">
                  <select
                    value={warehouse}
                    onChange={(e) => handleWarehouseChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
                  >
                    <option value="Основной склад ЗИП">Основной склад ЗИП</option>
                    <option value="Склад ГСМ №2">Склад ГСМ №2</option>
                    <option value="Цеховая кладовая №3">Цеховая кладовая №3</option>
                    <option value="Склад Инструмента">Склад Инструмента</option>
                    <option value="Центральный материальный склад">Центральный материальный склад</option>
                    <option value="Склад СИЗ и Спецодежды">Склад СИЗ и Спецодежды</option>
                    <option value="CUSTOM">+ Указать новый склад...</option>
                  </select>

                  {warehouse === "CUSTOM" && (
                    <input
                      type="text"
                      required
                      placeholder="Введите название нового склада..."
                      onChange={(e) => setWarehouse(e.target.value)}
                      className="w-full rounded-lg border border-[#3c82ed] bg-blue-50/50 px-3 py-2 text-[11px] outline-none font-medium"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">
                  Точная ячейка / Место хранения
                </label>
                <input
                  type="text"
                  value={cell}
                  onChange={(e) => setCell(e.target.value)}
                  placeholder="Стеллаж A-04 / Ячейка 12"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">Факт. остаток</label>
                <input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-bold text-[#17243a] focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">Мин. остаток</label>
                <input
                  type="number"
                  min="0"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-medium focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">Макс. норма</label>
                <input
                  type="number"
                  min="0"
                  value={maxQuantity}
                  onChange={(e) => setMaxQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-medium focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">Резерв</label>
                <input
                  type="number"
                  min="0"
                  value={reservedQuantity}
                  onChange={(e) => setReservedQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-medium focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">Цена ед. (руб)</label>
                <input
                  type="number"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-medium focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Integration, Responsible Person & Supplier */}
          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
            <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-[#3473d4] border-b border-slate-200/60 pb-2">
              <Box size={14} />
              3. Ответственность, Совместимость EPS и Поставщики
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">
                  Ответственное лицо (МОЛ / Заведующий)
                </label>
                <div className="space-y-1.5">
                  <select
                    value={responsibleUser}
                    onChange={(e) => setResponsibleUser(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
                  >
                    <option value="Смирнов А.В. (Старший кладовщик)">Смирнов А.В. (Старший кладовщик)</option>
                    <option value="Ковалев Д.М. (Кладовщик ГСМ)">Ковалев Д.М. (Кладовщик ГСМ)</option>
                    <option value="Сидоров А.Н. (Энергетик цеха)">Сидоров А.Н. (Энергетик цеха)</option>
                    <option value="Иванов И.И. (Главный механик)">Иванов И.И. (Главный механик)</option>
                    <option value="Петров В.С. (Старший мастер)">Петров В.С. (Старший мастер)</option>
                    <option value="CUSTOM">+ Назначить нового ответственного...</option>
                  </select>

                  {responsibleUser === "CUSTOM" && (
                    <input
                      type="text"
                      required
                      placeholder="ФИО и должность ответственного..."
                      onChange={(e) => setResponsibleUser(e.target.value)}
                      className="w-full rounded-lg border border-[#3c82ed] bg-blue-50/50 px-3 py-2 text-[11px] outline-none font-medium"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">
                  Совместимое оборудование EPS (через запятую)
                </label>
                <input
                  type="text"
                  value={compatibleEq}
                  onChange={(e) => setCompatibleEq(e.target.value)}
                  placeholder="EQ-CNC-2026-01, EQ-PRESS-2026-04"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 text-[11px] mb-1">Поставщик / Изготовитель</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="ООО СпецПодшипник Торг"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Specifications */}
          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-[#3473d4]">
                <Box size={14} />
                4. Технические характеристики
              </div>
              <button
                type="button"
                onClick={handleAddSpec}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#3473d4] hover:text-blue-700"
              >
                <Plus size={13} /> Добавить параметр
              </button>
            </div>

            <div className="space-y-2">
              {specs.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Название (напр. Внутренний диаметр)"
                    value={s.key}
                    onChange={(e) => handleSpecChange(idx, "key", e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
                  />
                  <input
                    type="text"
                    placeholder="Значение (напр. 20 мм)"
                    value={s.value}
                    onChange={(e) => handleSpecChange(idx, "value", e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSpec(idx)}
                    className="p-1 text-slate-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-4 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Save size={13} />
              {loading ? "Сохранение..." : "Сохранить карточку ТМЦ"}
            </button>
          </div>
        </form>

        {/* Modal Window: Matching Items Selection */}
        {showSuggestionModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                    <Box size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#17243a]">Обнаружены совпадающие позиции ТМЦ</h4>
                    <p className="text-[10px] text-slate-400">Выберите позицию для автозаполнения формы прихода или закройте окно</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSuggestionModal(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs">
                {matchingSuggestions.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 hover:bg-blue-50/50 hover:border-blue-200 transition"
                  >
                    <div className="space-y-0.5">
                      <div className="font-mono text-[11px] font-bold text-[#3473d4]">
                        {item.sku}
                      </div>
                      <div className="font-bold text-[#17243a] text-xs">{item.name}</div>
                      <div className="text-[10px] text-slate-500">
                        Склад: <span className="font-semibold text-slate-700">{item.warehouse}</span> ({item.cell}) • Категория: {item.category}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right text-[10px]">
                        <div className="font-bold text-[#17243a]">{item.quantity} {item.unit}</div>
                        <div className="text-slate-400">{item.unitPrice.toLocaleString("ru-RU")} ₽/ед.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyExistingItem(item)}
                        className="rounded-lg bg-[#2f74df] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#2565c8] transition shadow-2xs"
                      >
                        Выбрать позицию
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                <span className="text-slate-400">Не нашли нужную позицию?</span>
                <button
                  type="button"
                  onClick={() => setShowSuggestionModal(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Создать новую номенклатуру
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
