"use client";

import React, { useState, useEffect } from "react";
import { X, ArrowDownLeft, ArrowUpRight, RefreshCcw, UserCheck, Save, Box, ShieldAlert, Plus, Wrench, Trash2, Building2 } from "lucide-react";
import { WmsItem, WmsMovement, canUserManageItem, getWarehouseResponsibleUser, WAREHOUSES_REGISTRY } from "@/lib/modules/wms-store";
import { MOCK_EQUIPMENT_DATA } from "@/lib/modules/eps-store";
import { useShell } from "@/components/layout/shell-context";
import WmsItemForm from "@/components/wms/wms-item-form";

interface WmsOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: WmsItem[];
  selectedItems?: WmsItem[];
  defaultItemId?: string;
  defaultType?: WmsMovement["type"];
  onSubmitSuccess: (movement: WmsMovement, updatedItems?: Partial<WmsItem>[], newItem?: WmsItem) => void;
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
  const { currentUser } = useShell();

  const [operationType, setOperationType] = useState<WmsMovement["type"]>(defaultType);
  const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId || (items[0]?.id || ""));
  const [quantity, setQuantity] = useState<number>(1);
  // Состояние для хранения индивидуального количества каждой позиций при массовом выборе
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [performedBy, setPerformedBy] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Поля специфичные для Списания (OUTGOING)
  const [outgoingReasonType, setOutgoingReasonType] = useState<"EQUIPMENT" | "SCRAP" | "EXPIRED">("EQUIPMENT");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(MOCK_EQUIPMENT_DATA[0]?.id || "");
  const [scrapWriteoffReason, setScrapWriteoffReason] = useState<string>("Износ / Естественная выработка ресурса");

  // Поля специфичные для Перемещения (TRANSFER)
  const [sourceWarehouse, setSourceWarehouse] = useState<string>("Основной склад ЗИП");
  const [targetWarehouse, setTargetWarehouse] = useState<string>("Цеховая кладовая №3");
  const [transferCell, setTransferCell] = useState<string>("Ячейка В-12");

  // Поля специфичные для Выдачи на личную карточку (PERSONAL_CARD)
  const [recipientUser, setRecipientUser] = useState<string>("Иванов И.И. (Токарь 5 разряда, Табельный #4901)");
  const [issuanceType, setIssuanceType] = useState<"PPE" | "TOOL" | "CONSUMABLE">("TOOL");
  const [returnExpected, setReturnExpected] = useState<boolean>(true);

  // Общее поле основания / заказа-наряда
  const [reason, setReason] = useState<string>("");

  const isBulkMode = selectedItems.length > 1;
  const currentItem = items.find((i) => i.id === selectedItemId) || items[0];

  // Автоматический расчет ответственного МОЛ склада при смене позиции или склада-отправителя/получателя
  useEffect(() => {
    let targetWh = currentItem?.warehouse || sourceWarehouse;
    if (operationType === "TRANSFER") {
      targetWh = sourceWarehouse;
    }
    const respUser = getWarehouseResponsibleUser(targetWh);
    if (respUser) {
      setPerformedBy(respUser);
    } else if (currentUser?.displayName) {
      setPerformedBy(currentUser.displayName);
    }
  }, [currentItem, sourceWarehouse, operationType, currentUser, isOpen]);

  // Инициализация индивидуальных количеств при изменении списка выбранных элементов
  useEffect(() => {
    if (selectedItems.length > 0) {
      const initialMap: Record<string, number> = {};
      selectedItems.forEach((item) => {
        initialMap[item.id] = 1;
      });
      setItemQuantities(initialMap);
    }
  }, [selectedItems, isOpen]);

  if (!isOpen) return null;

  const handleItemQuantityChange = (itemId: string, val: number) => {
    setItemQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(1, val)
    }));
  };

  const getHeaderMeta = () => {
    switch (operationType) {
      case "INCOMING":
        return {
          title: "Оформление прихода ТМЦ / ЗИП",
          subtitle: "Регистрация поступления новой партии или номенклатуры на склад",
          iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
          submitBg: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
          submitText: "Провести приход ТМЦ"
        };
      case "OUTGOING":
        return {
          title: "Оформление списания ТМЦ / ЗИП",
          subtitle: "Списание на установку/ремонт оборудования EPS либо в неликвид/утиль",
          iconBg: "bg-amber-50 text-amber-600 border-amber-200",
          submitBg: "bg-amber-600 hover:bg-amber-700 shadow-amber-200",
          submitText: "Подтвердить списание"
        };
      case "TRANSFER":
        return {
          title: "Перемещение между складами WMS",
          subtitle: "Межскладской перевод и изменение местохранения номенклатуры",
          iconBg: "bg-blue-50 text-[#3473d4] border-blue-200",
          submitBg: "bg-[#2f74df] hover:bg-[#2565c8] shadow-blue-200",
          submitText: "Провести перемещение"
        };
      case "PERSONAL_CARD":
      default:
        return {
          title: "Выдача ТМЦ на личную карточку",
          subtitle: "Персонифицированная выдача СИЗ, спецодежды или инструмента сотруднику",
          iconBg: "bg-purple-50 text-purple-600 border-purple-200",
          submitBg: "bg-purple-600 hover:bg-purple-700 shadow-purple-200",
          submitText: "Выдать на карточку"
        };
    }
  };

  const headerMeta = getHeaderMeta();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetItemsList = isBulkMode ? selectedItems : (currentItem ? [currentItem] : []);
    
    const forbiddenItem = targetItemsList.find((item) => !canUserManageItem(currentUser, item));
    if (forbiddenItem) {
      const respUser = getWarehouseResponsibleUser(forbiddenItem.warehouse);
      setErrorMsg(`Отказ в доступе! Вы не являетесь МОЛ склада "${forbiddenItem.warehouse}". Назначенный МОЛ: ${respUser}`);
      return;
    }

    setLoading(true);
    const updatedItemsList: Partial<WmsItem>[] = [];

    let totalMovementQty = 0;

    targetItemsList.forEach((item) => {
      const itemQtyToProcess = isBulkMode ? (itemQuantities[item.id] || 1) : Number(quantity);
      totalMovementQty += itemQtyToProcess;

      let newQty = item.quantity;
      if (operationType === "INCOMING") {
        newQty += itemQtyToProcess;
      } else if (operationType === "OUTGOING" || operationType === "PERSONAL_CARD" || operationType === "TRANSFER") {
        newQty = Math.max(0, newQty - itemQtyToProcess);
      }

      const updatedObj: Partial<WmsItem> = {
        id: item.id,
        quantity: newQty,
        status: newQty === 0 ? "OUT_OF_STOCK" : newQty <= item.minQuantity ? "LOW_STOCK" : "IN_STOCK",
        updatedAt: new Date().toISOString(),
      };

      if (operationType === "TRANSFER") {
        updatedObj.warehouse = targetWarehouse;
        if (transferCell) updatedObj.cell = transferCell;
      }

      updatedItemsList.push(updatedObj);
    });

    const selectedEq = MOCK_EQUIPMENT_DATA.find((e) => e.id === selectedEquipmentId);
    let calculatedFromLocation = currentItem?.warehouse || sourceWarehouse;
    let calculatedToLocation = targetWarehouse;
    let calculatedReason = reason;

    if (operationType === "INCOMING") {
      calculatedFromLocation = "Поставщик / Покупка";
      calculatedToLocation = currentItem?.warehouse || "Основной склад ЗИП";
      calculatedReason = reason || "Приходная накладная / Поступление";
    } else if (operationType === "OUTGOING") {
      calculatedFromLocation = currentItem?.warehouse || "Основной склад ЗИП";
      if (outgoingReasonType === "EQUIPMENT") {
        calculatedToLocation = `Оборудование: ${selectedEq?.name || "Станок ЧПУ"}`;
        calculatedReason = reason || `Установка на ${selectedEq?.equipmentCode || "Оборудование"}`;
      } else {
        calculatedToLocation = "Утилизация / Списание неликвида";
        calculatedReason = reason || `Списание неликвида: ${scrapWriteoffReason}`;
      }
    } else if (operationType === "TRANSFER") {
      calculatedFromLocation = sourceWarehouse;
      calculatedToLocation = `${targetWarehouse} (${transferCell || "Ячейка по умолчанию"})`;
      calculatedReason = reason || "Межскладское перемещение";
    } else if (operationType === "PERSONAL_CARD") {
      calculatedFromLocation = currentItem?.warehouse || "Основной склад ЗИП";
      calculatedToLocation = `Личная карточка: ${recipientUser}`;
      calculatedReason = reason || `Выдача [${issuanceType === "PPE" ? "СИЗ" : issuanceType === "TOOL" ? "Инструмент" : "Расходник"}]. ${returnExpected ? "С возвратом" : "Без возврата"}`;
    }

    const firstItem = targetItemsList[0] || currentItem;
    const newMovement: WmsMovement = {
      id: `mov-${Date.now()}`,
      itemId: firstItem?.id || "bulk",
      itemSku: isBulkMode ? `ПАКЕТ (${targetItemsList.length} ТМЦ)` : (firstItem?.sku || "N/A"),
      itemName: isBulkMode ? `Групповая операция (${targetItemsList.length} позиций)` : (firstItem?.name || "N/A"),
      type: operationType,
      quantity: totalMovementQty,
      fromLocation: calculatedFromLocation,
      toLocation: calculatedToLocation,
      performedBy: performedBy || currentUser?.displayName || "Оператор WMS",
      recipientUser: operationType === "PERSONAL_CARD" ? recipientUser : undefined,
      reason: calculatedReason,
      relatedOrderOrEq: operationType === "OUTGOING" && outgoingReasonType === "EQUIPMENT" ? selectedEq?.equipmentCode : undefined,
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
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${headerMeta.iconBg} shadow-2xs`}>
              {operationType === "INCOMING" && <ArrowDownLeft size={20} />}
              {operationType === "OUTGOING" && <ArrowUpRight size={20} />}
              {operationType === "TRANSFER" && <RefreshCcw size={20} />}
              {operationType === "PERSONAL_CARD" && <UserCheck size={20} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#17243a] tracking-tight">{headerMeta.title}</h3>
              <p className="text-[11px] text-slate-400">{headerMeta.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-700">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-600" />
            <div className="flex-1 text-[11px] font-medium">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0 space-y-4 text-xs pr-1">
          {/* 1. Выбор номенклатуры / ТМЦ с указанием количества по каждой позиции при массовом выборе */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-600">
              {isBulkMode ? (
                <span className="flex items-center justify-between font-bold text-[#17243a]">
                  <span>Выбранные позиции ТМЦ и количество для каждой ({selectedItems.length} ед.):</span>
                  <span className="text-[#3473d4] text-[10px] font-semibold">Индивидуальный ввод</span>
                </span>
              ) : (
                <span>Выберите ТМЦ / ЗИП <span className="text-red-500">*</span></span>
              )}
            </label>

            {isBulkMode ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2 space-y-2 max-h-48 overflow-y-auto">
                {selectedItems.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-[#3473d4] shrink-0">{i.sku}</span>
                        <span className="text-slate-300">•</span>
                        <span className="font-semibold text-slate-800 truncate">{i.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Склад: <span className="text-slate-600 font-semibold">{i.warehouse}</span> (Остаток: {i.quantity} {i.unit})
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">Перевести:</span>
                      <input
                        type="number"
                        min="1"
                        max={operationType === "INCOMING" ? undefined : i.quantity}
                        value={itemQuantities[i.id] ?? 1}
                        onChange={(e) => handleItemQuantityChange(i.id, Number(e.target.value))}
                        className="w-14 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-center font-bold text-[#17243a] focus:border-[#3c82ed] focus:bg-white outline-none"
                      />
                      <span className="text-[10px] text-slate-500 font-semibold w-6 text-left">{i.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-2">
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

                  {operationType === "INCOMING" && (
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="shrink-0 flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-2xs"
                      title="Создать новую карточку номенклатуры ТМЦ в WMS"
                    >
                      <Plus size={14} /> Новая номенклатура
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Поле количества (для одиночного выбора) и МОЛ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isBulkMode && (
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  Количество ({currentItem?.unit || "ед."}) <span className="text-red-500">*</span>
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
            )}

            <div className={`space-y-1 ${isBulkMode ? "sm:col-span-2" : ""}`}>
              <label className="block text-[11px] font-semibold text-slate-600">
                Проводящий / Кладовщик (МОЛ)
              </label>
              <input
                type="text"
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[11px] outline-none font-semibold text-slate-700 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* =================СПЕЦИФИЧНЫЕ ПОЛЯ: ПРИХОД (INCOMING)================= */}
          {operationType === "INCOMING" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900">
                <ArrowDownLeft size={14} className="text-emerald-600" /> Размещение поступающих ТМЦ на складе
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Склад размещения (Назначение) <span className="text-red-500">*</span></label>
                  <select
                    value={targetWarehouse}
                    onChange={(e) => setTargetWarehouse(e.target.value)}
                    className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {WAREHOUSES_REGISTRY.map((w) => (
                      <option key={w.name} value={w.name}>
                        {w.name} (МОЛ: {w.responsibleUser})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Ячейка / Зона хранения</label>
                  <input
                    type="text"
                    value={transferCell}
                    onChange={(e) => setTransferCell(e.target.value)}
                    placeholder="Например: Стеллаж 2 / Ячейка А-04"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-medium text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =================СПЕЦИФИЧНЫЕ ПОЛЯ: СПИСАНИЕ (OUTGOING)================= */}
          {operationType === "OUTGOING" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                  <ArrowUpRight size={14} className="text-amber-600" />
                  Направление списания <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3 text-[11px]">
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="outgoingReason"
                      checked={outgoingReasonType === "EQUIPMENT"}
                      onChange={() => setOutgoingReasonType("EQUIPMENT")}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>На оборудование</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="outgoingReason"
                      checked={outgoingReasonType === "SCRAP"}
                      onChange={() => setOutgoingReasonType("SCRAP")}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>В неликвид / утиль</span>
                  </label>
                </div>
              </div>

              {outgoingReasonType === "EQUIPMENT" ? (
                <div className="space-y-1 text-[11px]">
                  <label className="block font-semibold text-slate-700 flex items-center gap-1">
                    <Wrench size={12} className="text-amber-600" /> Выберите целевое оборудование из реестра EPS:
                  </label>
                  <select
                    value={selectedEquipmentId}
                    onChange={(e) => setSelectedEquipmentId(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  >
                    {MOCK_EQUIPMENT_DATA.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.equipmentCode} — {eq.name} ({eq.department})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1 text-[11px]">
                  <label className="block font-semibold text-slate-700 flex items-center gap-1">
                    <Trash2 size={12} className="text-rose-600" /> Причина утилизации / неликвида:
                  </label>
                  <select
                    value={scrapWriteoffReason}
                    onChange={(e) => setScrapWriteoffReason(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="Износ / Естественная выработка ресурса">Износ / Естественная выработка ресурса</option>
                    <option value="Брак / Механическое повреждение">Брак / Механическое повреждение</option>
                    <option value="Истечение срока годности / Хранения">Истечение срока годности / Хранения</option>
                    <option value="Утрата свойств / Коррозия">Утрата свойств / Коррозия</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* =================СПЕЦИФИЧНЫЕ ПОЛЯ: ПЕРЕМЕЩЕНИЕ (TRANSFER)================= */}
          {operationType === "TRANSFER" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#17243a]">
                <RefreshCcw size={14} className="text-[#3473d4]" /> Маршрут межскладского перемещения
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Склад-отправитель (Источник)</label>
                  <input
                    type="text"
                    readOnly
                    value={currentItem?.warehouse || sourceWarehouse}
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-[11px] outline-none font-semibold text-slate-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Склад-получатель (Назначение) <span className="text-red-500">*</span></label>
                  <select
                    value={targetWarehouse}
                    onChange={(e) => setTargetWarehouse(e.target.value)}
                    className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-slate-800 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                  >
                    {WAREHOUSES_REGISTRY.map((w) => (
                      <option key={w.name} value={w.name}>
                        {w.name} (МОЛ: {w.responsibleUser})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                <label className="block font-semibold text-slate-600">Целевая ячейка на новом складе</label>
                <input
                  type="text"
                  value={transferCell}
                  onChange={(e) => setTransferCell(e.target.value)}
                  placeholder="Например: Ячейка В-12 / Стеллаж 4"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-medium text-slate-700 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          )}

          {/* =================СПЕЦИФИЧНЫЕ ПОЛЯ: ВЫДАЧА НА КАРТОЧКУ (PERSONAL_CARD)================= */}
          {operationType === "PERSONAL_CARD" && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-purple-900 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-purple-600" />
                  Сотрудник-получатель (Табельный номер) <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] font-semibold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">
                  Личная карточка
                </span>
              </div>
              <select
                value={recipientUser}
                onChange={(e) => setRecipientUser(e.target.value)}
                className="w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-slate-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              >
                <option value="Иванов И.И. (Токарь 5 разряда, Табельный #4901)">Иванов И.И. (Токарь 5 разряда, Табельный #4901)</option>
                <option value="Петров В.С. (Старший мастер, Табельный #4902)">Петров В.С. (Старший мастер, Табельный #4902)</option>
                <option value="Сидоров А.Н. (Электромонтер, Табельный #4905)">Сидоров А.Н. (Электромонтер, Табельный #4905)</option>
                <option value="Кузнецов П.А. (Слесарь-ремонтник, Табельный #4910)">Кузнецов П.А. (Слесарь-ремонтник, Табельный #4910)</option>
              </select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Категория выдачи</label>
                  <select
                    value={issuanceType}
                    onChange={(e) => setIssuanceType(e.target.value as any)}
                    className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-slate-700"
                  >
                    <option value="TOOL">Инструмент и оснастка</option>
                    <option value="PPE">Спецодежда / СИЗ</option>
                    <option value="CONSUMABLE">Расходные материалы</option>
                  </select>
                </div>
                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 bg-white p-2 rounded-lg border border-purple-200">
                    <input
                      type="checkbox"
                      checked={returnExpected}
                      onChange={(e) => setReturnExpected(e.target.checked)}
                      className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Возвратное имущество</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Общее поле основания / Заказ-наряда */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-600">Документ-основание / Заказ-наряд / Примечание</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                operationType === "INCOMING"
                  ? "Товарная накладная №491-В от поставщика"
                  : operationType === "OUTGOING"
                  ? "Наряд-допуск №882 / Акт списания №12"
                  : operationType === "TRANSFER"
                  ? "Распоряжение по цеху №44 / Служебная записка"
                  : "Заявка на выдачу инструмента №902"
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-medium text-slate-700 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-semibold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer ${headerMeta.submitBg}`}
            >
              <Save size={13} />
              {loading ? "Проведение..." : headerMeta.submitText}
            </button>
          </div>
        </form>

        {/* Modal Window: Create New Item when absent in DB */}
        <WmsItemForm
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          existingItems={items}
          onSubmitSuccess={(newItem) => {
            setShowCreateModal(false);
            setSelectedItemId(newItem.id);
            onSubmitSuccess(
              {
                id: `mov-${Date.now()}`,
                itemId: newItem.id,
                itemSku: newItem.sku,
                itemName: newItem.name,
                type: "INCOMING",
                quantity: newItem.quantity,
                fromLocation: "Поставщик / Покупка",
                toLocation: newItem.warehouse,
                performedBy: performedBy || currentUser?.displayName || "Оператор WMS",
                reason: "Первичное поступление новой номенклатуры",
                timestamp: new Date().toISOString()
              },
              [],
              newItem
            );
          }}
        />
      </div>
    </div>
  );
}
