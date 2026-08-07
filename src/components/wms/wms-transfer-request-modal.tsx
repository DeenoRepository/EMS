"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, RefreshCcw, Building2, Send, AlertTriangle, ShieldCheck, Box } from "lucide-react";
import { WmsItem, WAREHOUSES_REGISTRY, getWarehouseResponsibleUser } from "@/lib/modules/wms-store";
import { useShell } from "@/components/layout/shell-context";

interface WmsTransferRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: WmsItem[];
  onSubmitSuccess: () => void;
}

export default function WmsTransferRequestModal({
  isOpen,
  onClose,
  selectedItems,
  onSubmitSuccess,
}: WmsTransferRequestModalProps) {
  const { currentUser } = useShell();

  const [fromWarehouse, setFromWarehouse] = useState<string>("");
  const [toWarehouse, setToWarehouse] = useState<string>("Цеховая кладовая №3");
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("Пополнение запасов / Запрос под плановый ремонт");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && selectedItems.length > 0) {
      // 1. Автоматически определяем склад-источник по физическому местонахождению выбранных ТМЦ
      const sourceWh = selectedItems[0].warehouse;
      setFromWarehouse(sourceWh);

      // 2. Склад-получатель определяется строго по ответственности залогиненного кладовщика/заявителя
      const userWh = WAREHOUSES_REGISTRY.find(
        (w) =>
          w.responsibleUsername === currentUser?.username ||
          (currentUser?.displayName && w.responsibleUser.toLowerCase().includes(currentUser.displayName.toLowerCase()))
      );

      setToWarehouse(userWh ? userWh.name : "Цеховая кладовая №3");

      const initialQty: Record<string, number> = {};
      selectedItems.forEach((item) => {
        initialQty[item.id] = 1;
      });
      setQuantityMap(initialQty);
    }
  }, [selectedItems, isOpen, currentUser]);

  const uniqueSourceWarehouses = useMemo(() => {
    return Array.from(new Set(selectedItems.map((i) => i.warehouse))).filter(Boolean);
  }, [selectedItems]);

  const targetMolsList = useMemo(() => {
    return uniqueSourceWarehouses.map((wh) => ({
      warehouse: wh,
      mol: getWarehouseResponsibleUser(wh),
    }));
  }, [uniqueSourceWarehouses]);

  if (!isOpen) return null;

  const handleQtyChange = (id: string, qty: number) => {
    setQuantityMap((prev) => ({
      ...prev,
      [id]: Math.max(1, qty),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (fromWarehouse === toWarehouse) {
      setErrorMsg("Склад-источник и склад-получатель не могут совпадать.");
      return;
    }

    setLoading(true);

    try {
      // Отправляем запросы на перемещение для всех выбранных позиций,
      // адресованные именно МОЛ склада хранения КАЖДОЙ конкретной позиции
      for (const item of selectedItems) {
        const qty = quantityMap[item.id] || 1;
        const itemSourceWarehouse = item.warehouse || fromWarehouse;

        const res = await fetch("/api/modules/wms/transfer-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: item.id,
            itemSku: item.sku,
            itemName: item.name,
            quantity: qty,
            fromWarehouse: itemSourceWarehouse,
            toWarehouse,
            requestedBy: currentUser?.displayName || "Кладовщик-заявитель",
            requestedByUsername: currentUser?.username,
            reason,
          }),
        });

        if (!res.ok) {
          throw new Error(`Ошибка отправки запроса для позиции ${item.sku}`);
        }
      }

      setSuccessMsg("Запрос на перемещение успешно создан и отправлен кладовщику!");
      setTimeout(() => {
        onSubmitSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "Не удалось отправить запрос на перемещение.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#3473d4] border border-blue-200 shadow-2xs">
              <RefreshCcw size={20} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">
                WMS Складской учёт • Форма заявки на перемещение
              </div>
              <h2 className="text-base font-bold text-[#17243a] mt-0.5 tracking-tight">
                Запрос позиций с другого склада
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
            <ShieldCheck size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Warehouse Selector Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5 flex flex-col h-full">
              <label className="text-[11px] font-bold text-[#17243a] flex items-center gap-1.5">
                <Building2 size={13} className="text-[#3473d4] shrink-0" />
                {uniqueSourceWarehouses.length > 1
                  ? `Склады-источники (${uniqueSourceWarehouses.length}):`
                  : "Склад-источник (Откуда запрашиваем):"}
              </label>

              {uniqueSourceWarehouses.length > 1 ? (
                <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 space-y-1.5 text-xs">
                  <div className="font-bold text-[#17243a] text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <Building2 size={11} className="text-[#3473d4]" />
                    <span>Запрос с {uniqueSourceWarehouses.length} разных складов:</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {targetMolsList.map((item) => (
                      <div key={item.warehouse} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="font-bold text-[#17243a] text-[11px] truncate max-w-[120px]">{item.warehouse}</span>
                        <span className="text-[10px] text-slate-500 font-medium truncate max-w-[130px]" title={item.mol}>МОЛ: {item.mol}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between space-y-1">
                  <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-[#17243a]">
                    <span className="truncate">{uniqueSourceWarehouses[0] || fromWarehouse}</span>
                  </div>
                  <span className="block text-[10px] text-slate-400">
                    Ответственный МОЛ склада: <span className="font-semibold text-slate-700">{targetMolsList[0]?.mol}</span>
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 flex flex-col h-full">
              <label className="text-[11px] font-bold text-[#17243a] flex items-center gap-1.5">
                <Building2 size={13} className="text-[#3473d4] shrink-0" />
                Склад-получатель (Ваш склад):
              </label>
              <div className="flex-1 flex flex-col justify-between space-y-1">
                <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-[#17243a]">
                  <span className="truncate">{toWarehouse}</span>
                </div>
                <span className="block text-[10px] text-slate-400">
                  Запрашивающий сотрудник: <span className="font-semibold text-slate-700">{currentUser?.displayName || "Администратор EMS"}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Selected Items List */}
          <div className="space-y-2 pt-1">
            <label className="text-[11px] font-bold text-[#17243a] flex items-center justify-between">
              <span>Запрашиваемые позиции ТМЦ ({selectedItems.length}):</span>
            </label>
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs hover:border-blue-300 transition"
                >
                  <div className="flex items-start gap-2.5 max-w-[340px]">
                    <div className="rounded-lg bg-blue-50 p-2 text-[#3473d4] border border-blue-100 shrink-0 mt-0.5">
                      <Box size={15} />
                    </div>
                    <div>
                      <div className="font-bold text-[#17243a] text-[12px] leading-tight">{item.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                        <Building2 size={11} className="text-[#3473d4] shrink-0" />
                        <span>Склад хранения: <strong className="text-slate-800">{item.warehouse}</strong></span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        <span className="font-bold text-[#3473d4]">{item.sku}</span> • Доступно: {item.quantity} {item.unit}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Запрос:</span>
                    <input
                      type="number"
                      min={1}
                      max={item.quantity || 999}
                      value={quantityMap[item.id] || 1}
                      onChange={(e) => handleQtyChange(item.id, Number(e.target.value))}
                      className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2 text-center font-bold text-[#17243a] outline-none focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                    />
                    <span className="text-slate-500 font-semibold text-[11px] w-10 text-left truncate">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-bold text-[#17243a]">Основание / Причина перемещения:</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Укажите причину перемещения, объект или заказ-наряд..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-[11px] font-medium text-[#17243a] outline-none transition focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
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
              className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8] transition cursor-pointer disabled:opacity-50"
            >
              <Send size={13} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
