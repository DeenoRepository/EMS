"use client";

import React, { useState } from "react";
import { X, ArrowDownLeft, ArrowUpRight, RefreshCcw, UserCheck, Trash2, Save, Box } from "lucide-react";
import { WmsItem, WmsMovement } from "@/lib/modules/wms-store";

interface WmsOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: WmsItem[];
  selectedItems?: WmsItem[];
  defaultItemId?: string;
  defaultType?: WmsMovement["type"];
  onSubmitSuccess: (movement: WmsMovement, updatedItems?: Partial<WmsItem>[]) => void;
}

export default function WmsOperationModal({
  isOpen,
  onClose,
  items,
  selectedItems = [],
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
  const [reason, setReason] = useState<string>("Групповая операция над выбранными ТМЦ");
  const [relatedOrder, setRelatedOrder] = useState<string>("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isBulkMode = selectedItems.length > 1;
  const currentItem = items.find((i) => i.id === selectedItemId) || items[0];

  const handleTypeChange = (type: WmsMovement["type"]) => {
    setOperationType(type);
    if (type === "INCOMING") {
      setFromLocation("ООО Поставщик ТМЦ");
      setToLocation(currentItem?.warehouse || "Основной склад ЗИП");
      setReason(isBulkMode ? "Массовый приход номенклатуры" : "Приходная накладная / Поступление");
    } else if (type === "OUTGOING") {
      setFromLocation(currentItem?.warehouse || "Основной склад ЗИП");
      setToLocation("Цех №3 (Списание)");
      setReason(isBulkMode ? "Массовое списание ТМЦ в расход" : "Списание ТМЦ в расход");
    } else if (type === "TRANSFER") {
      setFromLocation(currentItem?.warehouse || "Основной склад ЗИП");
      setToLocation("Цеховая кладовая №3");
      setReason(isBulkMode ? "Массовое перемещение ТМЦ между складами" : "Внутреннее перемещение между складами");
    } else if (type === "PERSONAL_CARD") {
      setFromLocation(currentItem?.warehouse || "Основной склад ЗИП");
      setToLocation(`Личная карточка: ${recipientUser}`);
      setReason(isBulkMode ? "Массовая выдача спецодежды / инструмента на карточки" : "Выдача спецодежды / индивидуального инструмента на карточку работника");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    const targetItemsList = isBulkMode ? selectedItems : (currentItem ? [currentItem] : []);
    const updatedItemsList: Partial<WmsItem>[] = [];

    targetItemsList.forEach((item) => {
      let newQty = item.quantity;
      if (operationType === "INCOMING") {
        newQty += Number(quantity);
      } else if (operationType === "OUTGOING" || operationType === "PERSONAL_CARD") {
        newQty = Math.max(0, newQty - Number(quantity));
      }

      updatedItemsList.push({
        id: item.id,
        quantity: newQty,
        status: newQty === 0 ? "OUT_OF_STOCK" : newQty <= item.minQuantity ? "LOW_STOCK" : "IN_STOCK",
        updatedAt: new Date().toISOString(),
      });
    });

    const firstItem = targetItemsList[0] || currentItem;
    const newMovement: WmsMovement = {
      id: `mov-${Date.now()}`,
      itemId: firstItem?.id || "bulk",
      itemSku: isBulkMode ? `ПАКЕТ (${targetItemsList.length} ТМЦ)` : (firstItem?.sku || "N/A"),
      itemName: isBulkMode ? `Массовая операция (${targetItemsList.length} позиций)` : (firstItem?.name || "N/A"),
      type: operationType,
      quantity: Number(quantity) * targetItemsList.length,
      fromLocation,
      toLocation: operationType === "PERSONAL_CARD" ? `Личная карточка: ${recipientUser}` : toLocation,
      performedBy,
      recipientUser: operationType === "PERSONAL_CARD" ? recipientUser : undefined,
      reason,
      relatedOrderOrEq: relatedOrder || undefined,
      timestamp: new Date().toISOString(),
    };

    setTimeout(() => {
      onSubmitSuccess(newMovement, updatedItemsList);
      setLoading(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#3473d4]">
              <Box size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#17243a]">Оформление складской операции WMS</h3>
              <p className="text-[10px] text-slate-400">Проведение прихода, списания, перемещения или выдачи сотруднику</p>
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

        {/* Operation Type Switcher Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => handleTypeChange("INCOMING")}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border transition ${
              operationType === "INCOMING"
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold shadow-2xs"
                : "border-slate-200 bg-white text-slate-600 font-semibold hover:bg-slate-50"
            }`}
          >
            <ArrowDownLeft size={14} className={operationType === "INCOMING" ? "text-emerald-600" : "text-slate-400"} />
            <span>Приход</span>
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange("OUTGOING")}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border transition ${
              operationType === "OUTGOING"
                ? "bg-amber-50 border-amber-300 text-amber-700 font-bold shadow-2xs"
                : "border-slate-200 bg-white text-slate-600 font-semibold hover:bg-slate-50"
            }`}
          >
            <ArrowUpRight size={14} className={operationType === "OUTGOING" ? "text-amber-600" : "text-slate-400"} />
            <span>Списание</span>
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange("TRANSFER")}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border transition ${
              operationType === "TRANSFER"
                ? "bg-blue-50 border-blue-300 text-[#3473d4] font-bold shadow-2xs"
                : "border-slate-200 bg-white text-slate-600 font-semibold hover:bg-slate-50"
            }`}
          >
            <RefreshCcw size={14} className={operationType === "TRANSFER" ? "text-[#3473d4]" : "text-slate-400"} />
            <span>Перемещение</span>
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange("PERSONAL_CARD")}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border transition ${
              operationType === "PERSONAL_CARD"
                ? "bg-purple-50 border-purple-300 text-purple-700 font-bold shadow-2xs"
                : "border-slate-200 bg-white text-slate-600 font-semibold hover:bg-slate-50"
            }`}
          >
            <UserCheck size={14} className={operationType === "PERSONAL_CARD" ? "text-purple-600" : "text-slate-400"} />
            <span>На личн. карточку</span>
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0 space-y-4 text-xs pr-1">
          {/* Target Items Display (Single Select vs Bulk List) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-600">
              {isBulkMode ? (
                <span className="flex items-center justify-between font-bold text-[#17243a]">
                  <span>Выбранные позиции ТМЦ ({selectedItems.length} ед.):</span>
                  <span className="text-[#3473d4] text-[10px] font-semibold">Режим массовой обработки</span>
                </span>
              ) : (
                <span>Выберите ТМЦ / ЗИП <span className="text-red-500">*</span></span>
              )}
            </label>

            {isBulkMode ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 space-y-1.5 max-h-36 overflow-y-auto">
                {selectedItems.map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-[11px] bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                    <div className="font-mono truncate max-w-[280px]">
                      <span className="font-bold text-[#3473d4]">{i.sku}</span> — {i.name}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-600 shrink-0">
                      Остаток: {i.quantity} {i.unit}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-[#17243a] focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 transition"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.sku} — {i.name} (остаток: {i.quantity} {i.unit})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Numbers & Responsible */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600">
                {isBulkMode ? "Количество для КАЖДОЙ позиции" : `Количество (${currentItem?.unit || "ед."})`} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-bold text-[#17243a] focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600">
                Ответственный (Кладовщик / МОЛ)
              </label>
              <input
                type="text"
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-medium text-slate-700 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Special Field: Personal Card Employee Selection */}
          {operationType === "PERSONAL_CARD" && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-1.5">
              <label className="block text-[11px] font-bold text-purple-900 flex items-center gap-1.5">
                <UserCheck size={14} className="text-purple-600" />
                Сотрудник-получатель (Личная карточка / СИЗ / Инструмент) <span className="text-red-500">*</span>
              </label>
              <select
                value={recipientUser}
                onChange={(e) => setRecipientUser(e.target.value)}
                className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-slate-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              >
                <option value="Иванов И.И. (Токарь 5 разряда, Табельный #4901)">Иванов И.И. (Токарь 5 разряда, Табельный #4901)</option>
                <option value="Петров В.С. (Старший мастер, Табельный #4902)">Петров В.С. (Старший мастер, Табельный #4902)</option>
                <option value="Сидоров А.Н. (Электромонтер, Табельный #4905)">Сидоров А.Н. (Электромонтер, Табельный #4905)</option>
                <option value="Кузнецов П.А. (Слесарь-ремонтник, Табельный #4910)">Кузнецов П.А. (Слесарь-ремонтник, Табельный #4910)</option>
              </select>
            </div>
          )}

          {/* Locations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600">Откуда (Источник)</label>
              <input
                type="text"
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-medium text-slate-700 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600">Куда (Назначение)</label>
              <input
                type="text"
                disabled={operationType === "PERSONAL_CARD"}
                value={operationType === "PERSONAL_CARD" ? `Личная карточка: ${recipientUser}` : toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-medium text-slate-700 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100/70 disabled:text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-600">Основание / Причина / Заказ-наряд</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Приходная накладная #492 / Списание по ремонту"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-medium text-slate-700 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Footer Actions */}
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
              {loading ? "Проведение..." : "Провести операцию WMS"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
