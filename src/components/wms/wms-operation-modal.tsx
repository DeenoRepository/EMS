"use client";

import React, { useState } from "react";
import { X, ArrowDownLeft, ArrowUpRight, RefreshCcw, UserCheck, Trash2, Save, Box } from "lucide-react";
import { WmsItem, WmsMovement } from "@/lib/modules/wms-store";

interface WmsOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: WmsItem[];
  defaultItemId?: string;
  defaultType?: WmsMovement["type"];
  onSubmitSuccess: (movement: WmsMovement, updatedItem?: Partial<WmsItem>) => void;
}

export default function WmsOperationModal({
  isOpen,
  onClose,
  items,
  defaultItemId,
  defaultType = "INCOMING",
  onSubmitSuccess,
}: WmsOperationModalProps) {
  const [operationType, setOperationType] = useState<WmsMovement["type"]>(defaultType);
  const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId || (items[0]?.id || ""));
  const [quantity, setQuantity] = useState<number>(1);
  const [fromLocation, setFromLocation] = useState<string>("Поставщик / Покупка");
  const [toLocation, setToLocation] = useState<string>("Основной склад ЗИП");
  const [performedBy, setPerformedBy] = useState<string>("Смирнов А.В. (Старший кладовщик)");
  const [recipientUser, setRecipientUser] = useState<string>("Иванов И.И. (Токарь 5 разряда)");
  const [reason, setReason] = useState<string>("Поступление номенклатуры на склад");
  const [relatedOrder, setRelatedOrder] = useState<string>("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const currentItem = items.find((i) => i.id === selectedItemId) || items[0];

  const handleTypeChange = (type: WmsMovement["type"]) => {
    setOperationType(type);
    if (type === "INCOMING") {
      setFromLocation("ООО Поставщик ТМЦ");
      setToLocation(currentItem?.warehouse || "Основной склад ЗИП");
      setReason("Приходная накладная / Поступление");
    } else if (type === "OUTGOING") {
      setFromLocation(currentItem?.warehouse || "Основной склад ЗИП");
      setToLocation("Цех №3 (Списание)");
      setReason("Списание ТМЦ в расход");
    } else if (type === "TRANSFER") {
      setFromLocation(currentItem?.warehouse || "Основной склад ЗИП");
      setToLocation("Цеховая кладовая №3");
      setReason("Внутреннее перемещение между складами");
    } else if (type === "PERSONAL_CARD") {
      setFromLocation(currentItem?.warehouse || "Основной склад ЗИП");
      setToLocation(`Личная карточка: ${recipientUser}`);
      setReason("Выдача спецодежды / индивидуального инструмента на карточку работника");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem) return;

    setLoading(true);

    const newMovement: WmsMovement = {
      id: `mov-${Date.now()}`,
      itemId: currentItem.id,
      itemSku: currentItem.sku,
      itemName: currentItem.name,
      type: operationType,
      quantity: Number(quantity) || 1,
      fromLocation,
      toLocation: operationType === "PERSONAL_CARD" ? `Личная карточка: ${recipientUser}` : toLocation,
      performedBy,
      recipientUser: operationType === "PERSONAL_CARD" ? recipientUser : undefined,
      reason,
      relatedOrderOrEq: relatedOrder || undefined,
      timestamp: new Date().toISOString(),
    };

    // Calculate stock update
    let newQty = currentItem.quantity;
    if (operationType === "INCOMING") {
      newQty += Number(quantity);
    } else if (operationType === "OUTGOING" || operationType === "PERSONAL_CARD") {
      newQty = Math.max(0, newQty - Number(quantity));
    }

    const updatedItem: Partial<WmsItem> = {
      id: currentItem.id,
      quantity: newQty,
      status: newQty === 0 ? "OUT_OF_STOCK" : newQty <= currentItem.minQuantity ? "LOW_STOCK" : "IN_STOCK",
      updatedAt: new Date().toISOString(),
    };

    setTimeout(() => {
      onSubmitSuccess(newMovement, updatedItem);
      setLoading(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-100 p-6 space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-[#3473d4]">
              <Box size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#17243a]">Оформление складской операции WMS</h3>
              <p className="text-[10px] text-slate-400">Проведение прихода, списания, перемещения или выдачи сотруднику</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {/* Operation Type Switcher Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleTypeChange("INCOMING")}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border transition ${
              operationType === "INCOMING"
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs font-bold"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <ArrowDownLeft size={13} /> Приход
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange("OUTGOING")}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border transition ${
              operationType === "OUTGOING"
                ? "bg-amber-50 border-amber-300 text-amber-700 shadow-2xs font-bold"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <ArrowUpRight size={13} /> Списание
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange("TRANSFER")}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border transition ${
              operationType === "TRANSFER"
                ? "bg-blue-50 border-blue-300 text-[#3473d4] shadow-2xs font-bold"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <RefreshCcw size={13} /> Перемещение
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange("PERSONAL_CARD")}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border transition ${
              operationType === "PERSONAL_CARD"
                ? "bg-purple-50 border-purple-300 text-purple-700 shadow-2xs font-bold"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <UserCheck size={13} /> На личн. карточку
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Select Item */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Выберите ТМЦ / ЗИП <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-[#3c82ed] focus:outline-none bg-white font-medium"
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} — {i.name} (остаток: {i.quantity} {i.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Количество ({currentItem?.unit || "ед."}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-[#3c82ed] focus:outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Ответственный (Кладовщик/МОЛ)
              </label>
              <input
                type="text"
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-[#3c82ed] focus:outline-none"
              />
            </div>
          </div>

          {/* Special Field: Personal Card Employee Selection */}
          {operationType === "PERSONAL_CARD" && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-2">
              <label className="block text-[11px] font-bold text-purple-900 flex items-center gap-1.5">
                <UserCheck size={14} className="text-purple-600" />
                Сотрудник - Получатель (Личная карточка / СИЗ / Инструмент) <span className="text-red-500">*</span>
              </label>
              <select
                value={recipientUser}
                onChange={(e) => setRecipientUser(e.target.value)}
                className="w-full rounded-lg border border-purple-200 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none bg-white font-semibold text-slate-800"
              >
                <option value="Иванов И.И. (Токарь 5 разряда, Табельный #4901)">Иванов И.И. (Токарь 5 разряда, Табельный #4901)</option>
                <option value="Петров В.С. (Старший мастер, Табельный #4902)">Петров В.С. (Старший мастер, Табельный #4902)</option>
                <option value="Сидоров А.Н. (Электромонтер, Табельный #4905)">Сидоров А.Н. (Электромонтер, Табельный #4905)</option>
                <option value="Кузнецов П.А. (Слесарь-ремонтник, Табельный #4910)">Кузнецов П.А. (Слесарь-ремонтник, Табельный #4910)</option>
              </select>
            </div>
          )}

          {/* Locations */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Откуда (Источник)</label>
              <input
                type="text"
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-[#3c82ed] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Куда (Назначение)</label>
              <input
                type="text"
                disabled={operationType === "PERSONAL_CARD"}
                value={operationType === "PERSONAL_CARD" ? `Личная карточка: ${recipientUser}` : toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-[#3c82ed] focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Основание / Причина / Заказ-наряд</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Выдача инструмента по карточке / Приходная накладная #492"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-[#3c82ed] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#2565c8] disabled:opacity-50"
            >
              <Save size={13} />
              {loading ? "Проведение..." : "Провести операцию WMS"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
