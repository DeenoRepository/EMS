"use client";

import React, { useState, useEffect } from "react";
import { X, ArrowDownLeft, ArrowUpRight, RefreshCcw, UserCheck, Save, Box, ShieldAlert, Plus, Wrench, Trash2, Building2, Lock } from "lucide-react";
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

  // Состояния для живого ввода / автокомплита наименования номенклатуры при приходе
  const [incomingSearchQuery, setIncomingSearchQuery] = useState<string>("");
  const [selectedIncomingItemId, setSelectedIncomingItemId] = useState<string | null>(null);
  const [showIncomingSuggestions, setShowIncomingSuggestions] = useState<boolean>(false);

  // Расширенные параметры для создания новой номенклатуры ТМЦ (БЕЗ СТОИМОСТИ)
  const [newItemCategory, setNewItemCategory] = useState<string>("ЗИП и запчасти");
  const [newItemUnit, setNewItemUnit] = useState<WmsItem["unit"]>("pcs");
  const [newItemSku, setNewItemSku] = useState<string>("");
  const [newItemMinQty, setNewItemMinQty] = useState<number>(5);
  const [newItemCell, setNewItemCell] = useState<string>("Стеллаж 1 / Ячейка А-01");
  const [newItemDesc, setNewItemDesc] = useState<string>("");

  // Поля специфичные для Списания (OUTGOING)
  const [outgoingReasonType, setOutgoingReasonType] = useState<"EQUIPMENT" | "SCRAP" | "EXPIRED">("EQUIPMENT");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(MOCK_EQUIPMENT_DATA[0]?.id || "");
  const [equipmentSearchQuery, setEquipmentSearchQuery] = useState<string>("");
  const [showEquipmentSuggestions, setShowEquipmentSuggestions] = useState<boolean>(false);
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

  const currentItem = items.find((i) => i.id === selectedItemId) || items[0];

  // Состояние группового/массового выбора номенклатур
  const [bulkItemList, setBulkItemList] = useState<WmsItem[]>(selectedItems);
  const [isBulkModeActive, setIsBulkModeActive] = useState<boolean>(selectedItems.length > 1);
  const [addBulkSearchQuery, setAddBulkSearchQuery] = useState<string>("");
  const [showAddBulkSuggestions, setShowAddBulkSuggestions] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (selectedItems.length > 0) {
        setBulkItemList(selectedItems);
        setIsBulkModeActive(selectedItems.length > 1);
      } else if (currentItem) {
        setBulkItemList([currentItem]);
      }
    }
  }, [isOpen, selectedItems, currentItem]);

  // Синхронизация поиска и выбранной номенклатуры при открытии модального окна
  useEffect(() => {
    if (currentItem && isOpen) {
      setIncomingSearchQuery(currentItem.name);
      setSelectedIncomingItemId(currentItem.id);
      setNewItemUnit(currentItem.unit || "pcs");
      setNewItemCategory(currentItem.category || "ЗИП и запчасти");
      setNewItemMinQty(currentItem.minQuantity || 5);
      setNewItemCell(currentItem.cell || "Стеллаж 1 / Ячейка А-01");
      setNewItemDesc(currentItem.description || "");
      setShowIncomingSuggestions(false); // Не открываем выпадающий список сразу при открытии!
    }
  }, [selectedItemId, isOpen]);

  // Синхронизация поиска целевого оборудования при открытии модального окна
  const matchedEquipment = MOCK_EQUIPMENT_DATA.find((eq) => eq.id === selectedEquipmentId);
  useEffect(() => {
    if (matchedEquipment && isOpen) {
      setEquipmentSearchQuery(`${matchedEquipment.equipmentCode} — ${matchedEquipment.name}`);
      setShowEquipmentSuggestions(false);
    }
  }, [selectedEquipmentId, isOpen]);

  // Фильтрация оборудования EPS для выпадающего списка подсказок
  const filteredEquipmentList = MOCK_EQUIPMENT_DATA.filter((eq) => {
    if (!equipmentSearchQuery.trim()) return true;
    const q = equipmentSearchQuery.toLowerCase().trim();
    return (
      eq.name.toLowerCase().includes(q) ||
      eq.equipmentCode.toLowerCase().includes(q) ||
      eq.department.toLowerCase().includes(q) ||
      (eq.location && eq.location.toLowerCase().includes(q))
    );
  });

  // Фильтрация существующих номенклатур для выпадающего списка подсказок
  const filteredIncomingItems = items.filter((i) => {
    if (!incomingSearchQuery.trim()) return true;
    const q = incomingSearchQuery.toLowerCase().trim();
    return (
      i.name.toLowerCase().includes(q) ||
      i.sku.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    );
  });

  const matchedExistingItem = items.find(
    (i) => i.id === selectedIncomingItemId || i.name.toLowerCase().trim() === incomingSearchQuery.toLowerCase().trim()
  );
  const isSelectedExistingItem = Boolean(matchedExistingItem);

  // Определение доступных складов для материально-ответственного лица (МОЛ)
  const userAuthorizedWarehouses = WAREHOUSES_REGISTRY.filter((w) =>
    canUserManageItem(currentUser, w.name)
  );
  const userPrimaryWarehouse = userAuthorizedWarehouses[0]?.name || WAREHOUSES_REGISTRY[0].name;

  // При открытии окна Прихода устанавливаем целевой склад оприходования на уполномоченный склад пользователя
  useEffect(() => {
    if (isOpen && operationType === "INCOMING") {
      setTargetWarehouse(userPrimaryWarehouse);
    }
  }, [isOpen, operationType, userPrimaryWarehouse]);

  // Автоматический расчет ответственного МОЛ склада при смене позиции или склада-отправителя/получателя
  useEffect(() => {
    let targetWh = currentItem?.warehouse || sourceWarehouse;
    if (operationType === "INCOMING") {
      targetWh = targetWarehouse;
    } else if (operationType === "TRANSFER") {
      targetWh = sourceWarehouse;
    }
    const respUser = getWarehouseResponsibleUser(targetWh);
    if (respUser) {
      setPerformedBy(respUser);
    } else if (currentUser?.displayName) {
      setPerformedBy(currentUser.displayName);
    }
  }, [currentItem, sourceWarehouse, targetWarehouse, operationType, currentUser, isOpen]);

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

  const HEADERS_BY_TYPE: Record<WmsMovement["type"], { title: string; subtitle: string; submitText: string }> = {
    INCOMING: {
      title: "Оформление прихода ТМЦ / ЗИП",
      subtitle: "Регистрация поступления новой партии или номенклатуры на склад",
      submitText: "Провести приход ТМЦ",
    },
    OUTGOING: {
      title: "Оформление списания ТМЦ / ЗИП",
      subtitle: "Списание на установку/ремонт оборудования EPS либо в неликвид/утиль",
      submitText: "Подтвердить списание",
    },
    TRANSFER: {
      title: "Перемещение между складами WMS",
      subtitle: "Межскладской перевод и изменение местохранения номенклатуры",
      submitText: "Провести перемещение",
    },
    PERSONAL_CARD: {
      title: "Выдача ТМЦ на личную карточку",
      subtitle: "Персонифицированная выдача СИЗ, спецодежды или инструмента сотруднику",
      submitText: "Выдать на карточку",
    },
    RESERVE: { title: "Резерв", subtitle: "", submitText: "Сохранить" },
    ADJUSTMENT: { title: "Корректировка", subtitle: "", submitText: "Сохранить" },
  };

  const headerMeta = {
    ...HEADERS_BY_TYPE[operationType],
    iconBg: "bg-blue-50 text-[#3473d4] border-blue-200",
    submitBg: "bg-[#2f74df] hover:bg-[#2565c8] shadow-blue-200",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Для всех операций прихода проверяем, что текущий пользователь является МОЛ целевого склада
    if (operationType === "INCOMING") {
      if (!canUserManageItem(currentUser, targetWarehouse)) {
        const respUser = getWarehouseResponsibleUser(targetWarehouse);
        setErrorMsg(
          `Отказ в доступе! Приход может быть проведен только на склад, за который вы являетесь МОЛ. Назначенный МОЛ склада "${targetWarehouse}": ${respUser}.`
        );
        return;
      }
    }

    const targetItemsList = isBulkModeActive ? bulkItemList : (currentItem ? [currentItem] : []);
    
    if (operationType !== "INCOMING") {
      const forbiddenItem = targetItemsList.find((item) => !canUserManageItem(currentUser, item));
      if (forbiddenItem) {
        const respUser = getWarehouseResponsibleUser(forbiddenItem.warehouse);
        setErrorMsg(`Отказ в доступе! Вы не являетесь МОЛ склада "${forbiddenItem.warehouse}". Назначенный МОЛ: ${respUser}`);
        return;
      }
    }

    setLoading(true);

    // ================= 1. СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ ОДИНОЧНОГО ПРИХОДА (INCOMING) =================
    if (operationType === "INCOMING" && !isBulkModeActive && incomingSubMode === "SINGLE") {
      const itemQtyToProcess = Number(quantity);

      if (isSelectedExistingItem && matchedExistingItem) {
        // Оприходование на существующую номенклатуру
        const newQty = matchedExistingItem.quantity + itemQtyToProcess;
        const updatedObj: Partial<WmsItem> = {
          id: matchedExistingItem.id,
          quantity: newQty,
          lastIncomingDate: new Date().toISOString(),
          status: newQty === 0 ? "OUT_OF_STOCK" : newQty <= matchedExistingItem.minQuantity ? "LOW_STOCK" : "IN_STOCK",
          updatedAt: new Date().toISOString(),
        };

        const newMovement: WmsMovement = {
          id: `mov-${Date.now()}`,
          itemId: matchedExistingItem.id,
          itemSku: matchedExistingItem.sku,
          itemName: matchedExistingItem.name,
          type: "INCOMING",
          quantity: itemQtyToProcess,
          fromLocation: supplierName || "Поставщик / Покупка",
          toLocation: `${targetWarehouse} (${transferCell || "Ячейка по умолчанию"})`,
          performedBy: performedBy || currentUser?.displayName || "Оператор WMS",
          reason: reason || `Приход по накладной ${invoiceNumber} от ${invoiceDate}`,
          timestamp: new Date().toISOString(),
        };

        setTimeout(() => {
          onSubmitSuccess(newMovement, [updatedObj]);
          setLoading(false);
          onClose();
        }, 400);
        return;
      } else {
        // Автоматическое создание НОВОЙ номенклатуры ТМЦ при выполнении прихода
        const finalSku = newItemSku.trim() || `SKU-IN-${Date.now().toString().slice(-6)}`;
        const newItemName = incomingSearchQuery.trim() || "Новая номенклатура ТМЦ";

        const createdNewItemObj: WmsItem = {
          id: `wms-${Date.now()}`,
          sku: finalSku,
          name: newItemName,
          category: newItemCategory || "ЗИП и запчасти",
          type: "ZIP",
          unit: newItemUnit || "pcs",
          warehouse: targetWarehouse,
          cell: newItemCell || transferCell || "Стеллаж 1 / Ячейка А-01",
          quantity: itemQtyToProcess,
          minQuantity: newItemMinQty || 5,
          maxQuantity: 100,
          reservedQuantity: 0,
          unitPrice: 0,
          currency: "RUB",
          status: "IN_STOCK",
          description: newItemDesc || `Автоматически создано при приходе по накладной №${invoiceNumber || "б/н"} от ${invoiceDate}`,
          updatedAt: new Date().toISOString(),
          lastIncomingDate: new Date().toISOString(),
        };

        const newMovement: WmsMovement = {
          id: `mov-${Date.now()}`,
          itemId: createdNewItemObj.id,
          itemSku: createdNewItemObj.sku,
          itemName: createdNewItemObj.name,
          type: "INCOMING",
          quantity: itemQtyToProcess,
          fromLocation: supplierName || "Поставщик / Покупка",
          toLocation: `${targetWarehouse} (${transferCell || "Стеллаж 1 / Ячейка А-01"})`,
          performedBy: performedBy || currentUser?.displayName || "Оператор WMS",
          reason: reason || `Первичное поступление и автоматическое создание номенклатуры (УПД ${invoiceNumber})`,
          timestamp: new Date().toISOString(),
        };

        setTimeout(() => {
          onSubmitSuccess(newMovement, [], createdNewItemObj);
          setLoading(false);
          onClose();
        }, 400);
        return;
      }
    }

    // ================= 2. СТАНДАРТНАЯ ЛОГИКА ДЛЯ ДРУГИХ ТИПОВ ОПЕРАЦИЙ ИЛИ МАССОВОГО РЕЖИМА =================
    const updatedItemsList: Partial<WmsItem>[] = [];
    let totalMovementQty = 0;

    targetItemsList.forEach((item) => {
      const itemQtyToProcess = isBulkModeActive ? (itemQuantities[item.id] || 1) : Number(quantity);
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
      calculatedFromLocation = supplierName || "Поставщик / Покупка";
      calculatedToLocation = `${targetWarehouse} (${transferCell || "Ячейка по умолчанию"})`;
      calculatedReason = reason || `Накладная ${invoiceNumber} от ${invoiceDate}`;
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
    const isMassIncoming = operationType === "INCOMING" && incomingSubMode === "MASS_INVOICE";

    const newMovement: WmsMovement = {
      id: `mov-${Date.now()}`,
      itemId: firstItem?.id || "bulk",
      itemSku: isMassIncoming
        ? `НАКЛАДНАЯ (${massIncomingItems.length} ТМЦ)`
        : isBulkModeActive
        ? `ПАКЕТ (${targetItemsList.length} ТМЦ)`
        : (firstItem?.sku || "N/A"),
      itemName: isMassIncoming
        ? `Поступление по ${invoiceNumber} (${massIncomingItems.length} поз.)`
        : isBulkModeActive
        ? `Групповая операция (${targetItemsList.length} позиций)`
        : (firstItem?.name || "N/A"),
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
        className="w-full max-w-4xl lg:max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 md:p-7 shadow-2xl space-y-4.5 max-h-[92vh] flex flex-col my-auto transition-all"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3.5">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${headerMeta.iconBg} shadow-2xs shrink-0`}>
              {operationType === "INCOMING" && <ArrowDownLeft size={22} />}
              {operationType === "OUTGOING" && <ArrowUpRight size={22} />}
              {operationType === "TRANSFER" && <RefreshCcw size={22} />}
              {operationType === "PERSONAL_CARD" && <UserCheck size={22} />}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">
                WMS Складской учёт • Проведение операции
              </div>
              <h3 className="text-lg font-bold text-[#17243a] mt-0.5 tracking-tight">{headerMeta.title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-700">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />
            <div className="flex-1 text-[11px] font-medium">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0 space-y-5 text-xs pr-1.5 custom-scrollbar">
          {/* Выбор типа операции в единой форме EPS Standard */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-[#17243a]">
              Тип складской операции <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1">
              <button
                type="button"
                onClick={() => setOperationType("INCOMING")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  operationType === "INCOMING"
                    ? "bg-[#2f74df] text-white shadow-2xs"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <ArrowDownLeft size={13} /> Приход
              </button>
              <button
                type="button"
                onClick={() => setOperationType("OUTGOING")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  operationType === "OUTGOING"
                    ? "bg-[#2f74df] text-white shadow-2xs"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <ArrowUpRight size={13} /> Списание
              </button>
              <button
                type="button"
                onClick={() => setOperationType("TRANSFER")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  operationType === "TRANSFER"
                    ? "bg-[#2f74df] text-white shadow-2xs"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <RefreshCcw size={13} /> Перемещение
              </button>
              <button
                type="button"
                onClick={() => setOperationType("PERSONAL_CARD")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  operationType === "PERSONAL_CARD"
                    ? "bg-[#2f74df] text-white shadow-2xs"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <UserCheck size={13} /> На карточку
              </button>
            </div>
          </div>

          {/* 1. Выбор режима и номенклатуры / ТМЦ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <label className="block text-[11px] font-bold text-[#17243a]">
                {isBulkModeActive ? "Многопозиционная массовая операция" : "Выбор ТМЦ / ЗИП"} <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setIsBulkModeActive(false)}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    !isBulkModeActive
                      ? "bg-white text-[#17243a] font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Одиночная позиция
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkModeActive(true);
                    if (bulkItemList.length === 0 && items.length > 0) {
                      setBulkItemList([items[0]]);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    isBulkModeActive
                      ? "bg-white text-[#17243a] font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Массовая операция ({bulkItemList.length} поз.)
                </button>
              </div>
            </div>

            {isBulkModeActive ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#17243a]">
                  <span>Позиции массовой операции ({bulkItemList.length} поз.):</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAddBulkSuggestions(!showAddBulkSuggestions)}
                      className="flex items-center gap-1 text-[10px] font-bold text-[#3473d4] hover:underline cursor-pointer"
                    >
                      <Plus size={13} /> Добавить позицию ТМЦ в список
                    </button>
                  </div>
                </div>

                {/* Выпадающий автокомплит для добавления новых ТМЦ в массовый список */}
                <div className="relative">
                  <input
                    type="text"
                    value={addBulkSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAddBulkSearchQuery(val);
                      setShowAddBulkSuggestions(val.trim().length > 0);
                    }}
                    placeholder="Наберите наименование или артикул для добавления ТМЦ..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#17243a] outline-none focus:border-[#3c82ed] placeholder:text-slate-400"
                  />
                  {showAddBulkSuggestions && addBulkSearchQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl custom-scrollbar space-y-1">
                      {items
                        .filter(
                          (i) =>
                            !bulkItemList.some((b) => b.id === i.id) &&
                            (i.name.toLowerCase().includes(addBulkSearchQuery.toLowerCase().trim()) ||
                              i.sku.toLowerCase().includes(addBulkSearchQuery.toLowerCase().trim()) ||
                              i.category.toLowerCase().includes(addBulkSearchQuery.toLowerCase().trim()))
                        )
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setBulkItemList((prev) => [...prev, item]);
                              setAddBulkSearchQuery("");
                              setShowAddBulkSuggestions(false);
                            }}
                            className="w-full text-left p-2 rounded-lg hover:bg-blue-50/80 transition flex items-center justify-between gap-3 text-[11px] cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-mono font-bold text-[#3473d4]">{item.sku}</span> — {item.name}
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold">{item.quantity} {item.unit}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {bulkItemList.map((i, idx) => (
                    <div key={i.id} className="flex items-center justify-between gap-3 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-[#3473d4] shrink-0">{i.sku}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-[#17243a] truncate">{i.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          Склад: <span className="text-slate-700 font-semibold">{i.warehouse}</span> (В наличии: {i.quantity} {i.unit})
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">Кол-во:</span>
                        <input
                          type="number"
                          min="1"
                          max={operationType === "INCOMING" ? undefined : i.quantity}
                          value={itemQuantities[i.id] ?? 1}
                          onChange={(e) => handleItemQuantityChange(i.id, Number(e.target.value))}
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center font-bold text-[#17243a] focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                        <span className="text-[10px] text-slate-500 font-semibold w-6 text-left">{i.unit}</span>
                        {bulkItemList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setBulkItemList((prev) => prev.filter((b) => b.id !== i.id))}
                            className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Удалить из операции"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-lg bg-blue-50/80 p-2 text-[11px] text-[#17243a] font-bold border border-blue-100">
                  <span>Итого позиций в массовом списке ({bulkItemList.length} поз.):</span>
                  <span className="font-mono text-[#3473d4]">
                    {bulkItemList.reduce((sum, item) => sum + (itemQuantities[item.id] || 1), 0)} ед.
                  </span>
                </div>
              </div>
            ) : operationType === "INCOMING" ? (
              <div className="space-y-2.5 relative">
                <div className="relative">
                  <input
                    type="text"
                    value={incomingSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIncomingSearchQuery(val);
                      setShowIncomingSuggestions(val.trim().length > 0);
                      const exact = items.find(
                        (i) => i.name.toLowerCase().trim() === val.toLowerCase().trim() || i.sku.toLowerCase().trim() === val.toLowerCase().trim()
                      );
                      if (exact) {
                        setSelectedIncomingItemId(exact.id);
                        setSelectedItemId(exact.id);
                        setNewItemUnit(exact.unit);
                        setNewItemCategory(exact.category);
                        setNewItemMinQty(exact.minQuantity || 5);
                        setNewItemCell(exact.cell || "Стеллаж 1 / Ячейка А-01");
                        setShowIncomingSuggestions(false);
                      } else {
                        setSelectedIncomingItemId(null);
                      }
                    }}
                    onFocus={() => {
                      if (incomingSearchQuery.trim().length > 0 && !selectedIncomingItemId) {
                        setShowIncomingSuggestions(true);
                      }
                    }}
                    placeholder="Введите наименование или артикул ТМЦ для поиска или авто-создания..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-[#17243a] outline-none transition focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400 pr-8"
                  />
                  {incomingSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setIncomingSearchQuery("");
                        setSelectedIncomingItemId(null);
                        setShowIncomingSuggestions(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Выпадающий список найденных номенклатурных единиц из реестра (показывается ТОЛЬКО при наборе и отфильтрованных результатах) */}
                {showIncomingSuggestions && incomingSearchQuery.trim().length > 0 && !selectedIncomingItemId && (
                  <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl custom-scrollbar space-y-1">
                    {filteredIncomingItems.length > 0 && (
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Найденные номенклатурные единицы ({filteredIncomingItems.length}):
                      </div>
                    )}
                    {filteredIncomingItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedIncomingItemId(item.id);
                          setSelectedItemId(item.id);
                          setIncomingSearchQuery(item.name);
                          setNewItemUnit(item.unit);
                          setNewItemCategory(item.category);
                          setNewItemMinQty(item.minQuantity || 5);
                          setNewItemCell(item.cell || "Стеллаж 1 / Ячейка А-01");
                          setNewItemDesc(item.description || "");
                          setShowIncomingSuggestions(false);
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-blue-50/80 transition flex items-center justify-between gap-3 text-[11px] cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-[#3473d4]">{item.sku}</span>
                            <span className="text-slate-300">•</span>
                            <span className="font-bold text-[#17243a] truncate">{item.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                            Категория: <strong className="text-slate-700">{item.category}</strong> • В наличии: <strong className="text-slate-800">{item.quantity} {item.unit}</strong> • Ячейка: <span className="text-slate-700">{item.cell}</span>
                          </div>
                        </div>
                      </button>
                    ))}

                    {/* Быстрое подтверждение авто-создания новой номенклатуры */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIncomingItemId(null);
                        setShowIncomingSuggestions(false);
                      }}
                      className="w-full text-left p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-200 transition flex items-center gap-2 text-[11px] font-bold cursor-pointer mt-1"
                    >
                      <Plus size={14} className="text-emerald-600 shrink-0" />
                      <span>Заполнить карточку новой номенклатуры «{incomingSearchQuery.trim() || "Новая позиция"}»</span>
                    </button>
                  </div>
                )}

                {/* Индикатор найденной / новой номенклатуры с РАСШИРЕННЫМИ ПОЛЯМИ */}
                {isSelectedExistingItem && matchedExistingItem ? (
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50/90 px-3 py-2 text-[11px] text-emerald-900 border border-emerald-200 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                      <span>
                        Подгружены данные номенклатуры: <strong className="font-bold text-emerald-950">{matchedExistingItem.sku}</strong> — {matchedExistingItem.name}
                      </span>
                    </div>
                    <span className="font-semibold text-[10px] text-emerald-700 bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">
                      Остаток: {matchedExistingItem.quantity} {matchedExistingItem.unit} ({matchedExistingItem.cell})
                    </span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-3 text-[11px]">
                    <div className="flex items-center justify-between text-[#17243a] font-bold border-b border-blue-200/60 pb-2">
                      <div className="flex items-center gap-2 text-[#3473d4]">
                        <Plus size={15} />
                        <span>Номенклатура отсутствует в базе. Карточка будет создана автоматически при приходе:</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-white px-2.5 py-0.5 rounded-md border border-blue-200">
                        Создание карточки ТМЦ
                      </span>
                    </div>

                    {/* Расширенная сетка полей для карточки ТМЦ (БЕЗ СТОИМОСТИ) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase">Категория ТМЦ <span className="text-rose-500">*</span></label>
                        <select
                          value={newItemCategory}
                          onChange={(e) => setNewItemCategory(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#17243a] outline-none focus:border-[#3c82ed]"
                        >
                          <option value="ЗИП и запчасти">ЗИП и запчасти</option>
                          <option value="Подшипники">Подшипники</option>
                          <option value="Смазочные материалы">Смазочные материалы</option>
                          <option value="Гидравлика">Гидравлика</option>
                          <option value="Расходные материалы">Расходные материалы</option>
                          <option value="Электрокомпоненты">Электрокомпоненты</option>
                          <option value="Механика">Механика</option>
                          <option value="Метизы">Метизы</option>
                          <option value="Инструменты и оснастка">Инструменты и оснастка</option>
                          <option value="Спецодежда / СИЗ">Спецодежда / СИЗ</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase">Ед. измерения <span className="text-rose-500">*</span></label>
                        <select
                          value={newItemUnit}
                          onChange={(e) => setNewItemUnit(e.target.value as any)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#17243a] outline-none focus:border-[#3c82ed]"
                        >
                          <option value="pcs">pcs (шт)</option>
                          <option value="kg">kg (кг)</option>
                          <option value="l">l (л)</option>
                          <option value="m">m (м)</option>
                          <option value="set">set (компл)</option>
                          <option value="box">box (упак)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase">Артикул (SKU)</label>
                        <input
                          type="text"
                          value={newItemSku}
                          onChange={(e) => setNewItemSku(e.target.value)}
                          placeholder="Авто: SKU-IN-..."
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-mono font-bold text-[#3473d4] outline-none focus:border-[#3c82ed]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase">Мин. неснижаемый остаток</label>
                        <input
                          type="number"
                          min="0"
                          value={newItemMinQty}
                          onChange={(e) => setNewItemMinQty(Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#17243a] outline-none focus:border-[#3c82ed]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase">Ячейка / Зона хранения</label>
                        <input
                          type="text"
                          value={newItemCell}
                          onChange={(e) => setNewItemCell(e.target.value)}
                          placeholder="Стеллаж 1 / Ячейка А-01"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#17243a] outline-none focus:border-[#3c82ed]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase">Описание / Назначение</label>
                        <input
                          type="text"
                          value={newItemDesc}
                          onChange={(e) => setNewItemDesc(e.target.value)}
                          placeholder="Краткое описание ТМЦ..."
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#17243a] outline-none focus:border-[#3c82ed]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 relative">
                <div className="relative">
                  <input
                    type="text"
                    value={incomingSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIncomingSearchQuery(val);
                      setShowIncomingSuggestions(val.trim().length > 0);
                      const exact = items.find(
                        (i) => i.name.toLowerCase().trim() === val.toLowerCase().trim() || i.sku.toLowerCase().trim() === val.toLowerCase().trim()
                      );
                      if (exact) {
                        setSelectedItemId(exact.id);
                        setSelectedIncomingItemId(exact.id);
                        setShowIncomingSuggestions(false);
                      }
                    }}
                    onFocus={() => {
                      if (incomingSearchQuery.trim().length > 0) {
                        setShowIncomingSuggestions(true);
                      }
                    }}
                    placeholder="Введите наименование или артикул ТМЦ для подбора..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-[#17243a] outline-none transition focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400 pr-8"
                  />
                  {incomingSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setIncomingSearchQuery("");
                        setShowIncomingSuggestions(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Выпадающий список найдейных совпадений из реестра в наличии */}
                {showIncomingSuggestions && incomingSearchQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl custom-scrollbar space-y-1">
                    {filteredIncomingItems.length > 0 ? (
                      filteredIncomingItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setSelectedIncomingItemId(item.id);
                            setIncomingSearchQuery(item.name);
                            setShowIncomingSuggestions(false);
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-blue-50/80 transition flex items-center justify-between gap-3 text-[11px] cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-[#3473d4]">{item.sku}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-[#17243a] truncate">{item.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                              Категория: <strong className="text-slate-700">{item.category}</strong> • В наличии: <strong className="text-slate-800">{item.quantity} {item.unit}</strong> • Склад: <span className="text-slate-700">{item.warehouse}</span> ({item.cell})
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-slate-400 text-[11px]">
                        По запросу «{incomingSearchQuery}» ничего не найдено в наличии
                      </div>
                    )}
                  </div>
                )}

                {/* Идентификатор выбранного ТМЦ */}
                {currentItem && (
                  <div className="flex items-center justify-between rounded-lg bg-blue-50/70 px-3 py-2 text-[11px] text-[#17243a] border border-blue-100 font-medium">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full bg-[#3473d4] shrink-0" />
                      <span className="truncate">
                        Выбрано: <strong className="font-bold text-[#17243a]">{currentItem.sku}</strong> — {currentItem.name}
                      </span>
                    </div>
                    <span className="font-semibold text-[10px] text-[#3473d4] bg-white px-2 py-0.5 rounded-md border border-blue-200 shrink-0 ml-2">
                      В наличии: {currentItem.quantity} {currentItem.unit} ({currentItem.warehouse})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Склад оприходования: чётко зафиксирован и недоступен к изменению */}
          {operationType === "INCOMING" && (
            <div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-slate-50/90 p-3 text-[11px]">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-[#17243a]">
                  Склад оприходования (Фиксированное назначение)
                </label>
                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                  <Lock size={12} className="text-slate-400" /> Зафиксировано
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-[#17243a] shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>{targetWarehouse || userPrimaryWarehouse}</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">
                  МОЛ: {getWarehouseResponsibleUser(targetWarehouse || userPrimaryWarehouse)}
                </span>
              </div>

              <div className="text-[10px] text-slate-500 font-medium">
                🔒 Изменение склада прихода запрещено. Позиции оприходуются строго на закрепленный склад вашей материальной ответственности.
              </div>
            </div>
          )}

          {/* 2. Поле количества (для одиночного выбора) и МОЛ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isBulkModeActive && (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[#17243a]">
                  Количество ({currentItem?.unit || "ед."}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-bold text-[#17243a] focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
            )}

            <div className={`space-y-1 ${isBulkModeActive ? "sm:col-span-2" : ""}`}>
              <label className="block text-[11px] font-bold text-[#17243a]">
                Проводящий / Кладовщик (МОЛ)
              </label>
              <input
                type="text"
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-[#17243a] focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
          </div>



          {/* =================СПЕЦИФИЧНЫЕ ПОЛЯ: СПИСАНИЕ (OUTGOING)================= */}
          {operationType === "OUTGOING" && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3.5">
              {/* Фиксированный склад-источник списания */}
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-[#17243a]">
                    Склад списания (Источник хранения)
                  </label>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                    <Lock size={12} className="text-slate-400" /> Зафиксировано
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-[#17243a] shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                    <span>{currentItem?.warehouse || sourceWarehouse}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">
                    МОЛ: {getWarehouseResponsibleUser(currentItem?.warehouse || sourceWarehouse)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5 pt-1">
                <label className="block text-[11px] font-bold text-[#17243a] flex items-center gap-1.5">
                  <ArrowUpRight size={15} className="text-[#3473d4]" />
                  Направление списания <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-3 text-[11px]">
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#17243a]">
                    <input
                      type="radio"
                      name="outgoingReason"
                      checked={outgoingReasonType === "EQUIPMENT"}
                      onChange={() => setOutgoingReasonType("EQUIPMENT")}
                      className="text-[#3473d4] focus:ring-blue-400"
                    />
                    <span>На оборудование</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#17243a]">
                    <input
                      type="radio"
                      name="outgoingReason"
                      checked={outgoingReasonType === "SCRAP"}
                      onChange={() => setOutgoingReasonType("SCRAP")}
                      className="text-[#3473d4] focus:ring-blue-400"
                    />
                    <span>В неликвид / утиль</span>
                  </label>
                </div>
              </div>

              {outgoingReasonType === "EQUIPMENT" ? (
                <div className="space-y-2 relative text-[11px]">
                  <label className="block font-bold text-[#17243a] flex items-center gap-1">
                    <Wrench size={13} className="text-[#3473d4]" /> Целевое оборудование из реестра EPS <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={equipmentSearchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEquipmentSearchQuery(val);
                        setShowEquipmentSuggestions(val.trim().length > 0);
                        const exact = MOCK_EQUIPMENT_DATA.find(
                          (eq) =>
                            eq.equipmentCode.toLowerCase().trim() === val.toLowerCase().trim() ||
                            eq.name.toLowerCase().trim() === val.toLowerCase().trim()
                        );
                        if (exact) {
                          setSelectedEquipmentId(exact.id);
                          setShowEquipmentSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        if (equipmentSearchQuery.trim().length > 0) {
                          setShowEquipmentSuggestions(true);
                        }
                      }}
                      placeholder="Введите код оборудования, наименование или цех..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-[#17243a] outline-none transition focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400 pr-8"
                    />
                    {equipmentSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setEquipmentSearchQuery("");
                          setShowEquipmentSuggestions(false);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Выпадающий список найденного оборудования EPS (показывается при вводе) */}
                  {showEquipmentSuggestions && equipmentSearchQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl custom-scrollbar space-y-1">
                      {filteredEquipmentList.length > 0 ? (
                        filteredEquipmentList.map((eq) => (
                          <button
                            key={eq.id}
                            type="button"
                            onClick={() => {
                              setSelectedEquipmentId(eq.id);
                              setEquipmentSearchQuery(`${eq.equipmentCode} — ${eq.name}`);
                              setShowEquipmentSuggestions(false);
                            }}
                            className="w-full text-left p-2 rounded-lg hover:bg-blue-50/80 transition flex items-center justify-between gap-3 text-[11px] cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-[#3473d4]">{eq.equipmentCode}</span>
                                <span className="text-slate-300">•</span>
                                <span className="font-bold text-[#17243a] truncate">{eq.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                Подразделение: <strong className="text-slate-700">{eq.department}</strong> • Локация: <span className="text-slate-700">{eq.location || "Цех №1"}</span>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-slate-400 text-[11px]">
                          По запросу «{equipmentSearchQuery}» оборудование в реестре EPS не найдено
                        </div>
                      )}
                    </div>
                  )}

                  {/* Индикатор подгруженного целевого оборудования */}
                  {matchedEquipment && (
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50/90 px-3 py-2 text-[11px] text-emerald-950 border border-emerald-200 font-medium">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="truncate">
                          Выбрано оборудование: <strong className="font-bold text-emerald-950">{matchedEquipment.equipmentCode}</strong> — {matchedEquipment.name}
                        </span>
                      </div>
                      <span className="font-semibold text-[10px] text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shrink-0 ml-2">
                        {matchedEquipment.department}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1 text-[11px]">
                  <label className="block font-bold text-[#17243a] flex items-center gap-1">
                    <Trash2 size={13} className="text-rose-500" /> Причина утилизации / неликвида <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={scrapWriteoffReason}
                    onChange={(e) => setScrapWriteoffReason(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-[#17243a] focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 transition"
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
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#17243a] border-b border-slate-200/60 pb-2.5">
                <RefreshCcw size={15} className="text-[#3473d4]" /> Маршрут межскладского перемещения
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-[#17243a]">Склад-отправитель (Источник)</label>
                    <span className="flex items-center gap-1 text-[9px] font-bold text-slate-600">
                      <Lock size={10} /> Зафиксировано
                    </span>
                  </div>
                  <div className="flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-[#17243a] shadow-2xs">
                    <span>{currentItem?.warehouse || sourceWarehouse}</span>
                    <span className="text-[10px] font-medium text-slate-500">
                      МОЛ: {getWarehouseResponsibleUser(currentItem?.warehouse || sourceWarehouse)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-[#17243a]">Склад-получатель (Назначение) <span className="text-rose-500">*</span></label>
                  <select
                    value={targetWarehouse}
                    onChange={(e) => setTargetWarehouse(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-[#17243a] focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 transition"
                  >
                    {WAREHOUSES_REGISTRY.filter((w) => w.name !== (currentItem?.warehouse || sourceWarehouse)).map((w) => (
                      <option key={w.name} value={w.name}>
                        {w.name} (МОЛ: {w.responsibleUser})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

            </div>
          )}

          {/* =================СПЕЦИФИЧНЫЕ ПОЛЯ: ВЫДАЧА НА КАРТОЧКУ (PERSONAL_CARD)================= */}
          {operationType === "PERSONAL_CARD" && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                <label className="block text-[11px] font-bold text-[#17243a] flex items-center gap-1.5">
                  <UserCheck size={15} className="text-[#3473d4]" />
                  Сотрудник-получатель (Табельный номер) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] font-bold text-[#3473d4] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  Личная карточка
                </span>
              </div>
              <select
                value={recipientUser}
                onChange={(e) => setRecipientUser(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-[#17243a] focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 transition"
              >
                <option value="Иванов И.И. (Токарь 5 разряда, Табельный #4901)">Иванов И.И. (Токарь 5 разряда, Табельный #4901)</option>
                <option value="Петров В.С. (Старший мастер, Табельный #4902)">Петров В.С. (Старший мастер, Табельный #4902)</option>
                <option value="Сидоров А.Н. (Электромонтер, Табельный #4905)">Сидоров А.Н. (Электромонтер, Табельный #4905)</option>
                <option value="Кузнецов П.А. (Слесарь-ремонтник, Табельный #4910)">Кузнецов П.А. (Слесарь-ремонтник, Табельный #4910)</option>
              </select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="space-y-1">
                  <label className="block font-bold text-[#17243a]">Категория выдачи</label>
                  <select
                    value={issuanceType}
                    onChange={(e) => setIssuanceType(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none font-semibold text-[#17243a] transition"
                  >
                    <option value="TOOL">Инструмент и оснастка</option>
                    <option value="PPE">Спецодежда / СИЗ</option>
                    <option value="CONSUMABLE">Расходные материалы</option>
                  </select>
                </div>
                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#17243a] bg-white p-2 rounded-lg border border-slate-200">
                    <input
                      type="checkbox"
                      checked={returnExpected}
                      onChange={(e) => setReturnExpected(e.target.checked)}
                      className="rounded border-slate-300 text-[#3473d4] focus:ring-blue-400"
                    />
                    <span>Возвратное имущество</span>
                  </label>
                </div>
              </div>
            </div>
          )}



          <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
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
