"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader, SearchableSelect } from "@/components/ui";
import { Send, Plus, Trash2, AlertCircle, Barcode, CheckCircle2, ClipboardList } from "lucide-react";
import { WmsItem, Warehouse, RequisitionRowPayload, RequisitionHeaderPayload } from "@/types/wms";
import { getAvailableStock, validateStockLimit, scanBarcodeStub, checkDirtyFormClose } from "./wms-modal-utils";

interface RequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  items?: WmsItem[];
  warehouses?: Warehouse[];
  initialSelectedIds?: string[];
  currentUserDisplayName?: string;
}

type StepType = 1 | 2 | 3;

export function RequisitionModal({
  isOpen,
  onClose,
  onSuccess,
  items = [],
  warehouses = [],
  initialSelectedIds = [],
  currentUserDisplayName = "Инженер (editor)"
}: RequisitionModalProps) {
  const safeItems = items || [];
  const safeWarehouses = warehouses || [];

  const [step, setStep] = useState<StepType>(1);
  const [isDirty, setIsDirty] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [header, setHeader] = useState<RequisitionHeaderPayload>({
    fromWarehouse: safeWarehouses[0]?.name || "",
    toWarehouse: safeWarehouses[1]?.name || safeWarehouses[0]?.name || "",
    requestedBy: currentUserDisplayName,
    note: ""
  });

  const [rows, setRows] = useState<RequisitionRowPayload[]>([
    { id: "1", selectedItemId: safeItems[0]?.id || "", quantity: 1, isPreselected: false }
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setIsDirty(false);
      setErrorMessage(null);
      setBarcodeInput("");

      if (safeWarehouses.length > 0) {
        setHeader((prev) => ({
          ...prev,
          fromWarehouse: prev.fromWarehouse || safeWarehouses[0].name,
          toWarehouse: prev.toWarehouse || safeWarehouses[1]?.name || safeWarehouses[0].name
        }));
      }

      if (initialSelectedIds.length > 0) {
        const selectedRows = initialSelectedIds.map((id, index) => ({
          id: String(index + 1),
          selectedItemId: id,
          quantity: 1,
          isPreselected: true
        }));
        setRows(selectedRows);
      } else if (safeItems.length > 0) {
        setRows([{ id: "1", selectedItemId: safeItems[0].id, quantity: 1, isPreselected: false }]);
      }
    }
  }, [isOpen, initialSelectedIds, safeItems, safeWarehouses]);

  if (!isOpen) return null;

  const addRow = () => {
    setIsDirty(true);
    const defaultItemId = safeItems[0]?.id || "";
    setRows((prev) => [
      ...prev,
      { id: Date.now().toString(), selectedItemId: defaultItemId, quantity: 1, isPreselected: false }
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setIsDirty(true);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, fields: Partial<RequisitionRowPayload>) => {
    setIsDirty(true);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)));
  };

  const handleBarcodeScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    scanBarcodeStub(
      barcodeInput,
      safeItems,
      (matchedItem) => {
        setIsDirty(true);
        const existingIndex = rows.findIndex((r) => r.selectedItemId === matchedItem.id);
        if (existingIndex >= 0) {
          const updatedRows = [...rows];
          updatedRows[existingIndex].quantity += 1;
          setRows(updatedRows);
        } else {
          setRows((prev) => [
            ...prev,
            { id: Date.now().toString(), selectedItemId: matchedItem.id, quantity: 1, isPreselected: false }
          ]);
        }
        setBarcodeInput("");
      },
      (msg) => setErrorMessage(msg)
    );
  };

  const handleSafeClose = () => {
    checkDirtyFormClose(isDirty, onClose);
  };

  const isSameWarehouse = header.fromWarehouse === header.toWarehouse;

  const goToStep2 = () => {
    setErrorMessage(null);
    if (isSameWarehouse) {
      setErrorMessage("Склад-источник и склад-получатель должны различаться");
      return;
    }
    setStep(2);
  };

  const goToStep3 = () => {
    setErrorMessage(null);
    for (const r of rows) {
      const item = safeItems.find((i) => i.id === r.selectedItemId);
      const stock = getAvailableStock(item);
      const val = validateStockLimit(r.quantity, stock);
      if (!val.isValid) {
        setErrorMessage(`Позиция "${item?.name || 'ТМЦ'}": ${val.errorMessage}`);
        return;
      }
    }
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const payloadItems = rows
      .map((row) => {
        const item = safeItems.find((i) => i.id === row.selectedItemId);
        if (!item) return null;
        return {
          itemId: item.id,
          itemSku: item.sku,
          itemName: item.name,
          quantity: row.quantity
        };
      })
      .filter(Boolean);

    if (payloadItems.length === 0) {
      setErrorMessage("Выберите хотя бы одну позицию ТМЦ для запроса");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWarehouse: header.fromWarehouse,
          toWarehouse: header.toWarehouse,
          requestedBy: header.requestedBy,
          note: header.note,
          items: payloadItems
        })
      });

      if (res.ok) {
        setIsDirty(false);
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Ошибка при создании заявки на перемещение");
      }
    } catch (err) {
      console.error("Failed to create requisition:", err);
      setErrorMessage("Ошибка сети при отправке заявки");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleSafeClose} size="lg">
      <ModalHeader title="Запрос на перемещение / Выдачу ТМЦ" onClose={handleSafeClose} />

      {/* Stepper Progress Bar */}
      <div className="flex border-b border-slate-200 px-6 py-3 bg-slate-50/70 items-center justify-between">
        <div className={`flex items-center gap-2 text-xs font-bold ${step === 1 ? "text-blue-600" : "text-slate-500"}`}>
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]">1</span>
          <span>Параметры заявки</span>
        </div>
        <div className="h-0.5 w-12 bg-slate-200" />
        <div className={`flex items-center gap-2 text-xs font-bold ${step === 2 ? "text-blue-600" : "text-slate-500"}`}>
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]">2</span>
          <span>Спецификация ТМЦ</span>
        </div>
        <div className="h-0.5 w-12 bg-slate-200" />
        <div className={`flex items-center gap-2 text-xs font-bold ${step === 3 ? "text-blue-600" : "text-slate-500"}`}>
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]">3</span>
          <span>Регистрация</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Parameters */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Склад-источник (Откуда) *</label>
                <select
                  value={header.fromWarehouse}
                  onChange={(e) => {
                    setIsDirty(true);
                    setHeader({ ...header, fromWarehouse: e.target.value });
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  {safeWarehouses.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Склад-получатель (Куда) *</label>
                <select
                  value={header.toWarehouse}
                  onChange={(e) => {
                    setIsDirty(true);
                    setHeader({ ...header, toWarehouse: e.target.value });
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  {safeWarehouses.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Заявитель / Инициатор</label>
              <input
                type="text"
                value={header.requestedBy}
                onChange={(e) => {
                  setIsDirty(true);
                  setHeader({ ...header, requestedBy: e.target.value });
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Примечание к заявке</label>
              <textarea
                rows={2}
                value={header.note || ""}
                onChange={(e) => {
                  setIsDirty(true);
                  setHeader({ ...header, note: e.target.value });
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                placeholder="Укажите номер производственной задачи или объект назначения..."
              />
            </div>
          </div>
        )}

        {/* Step 2: Specification */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Barcode scanner toolbar */}
            <div className="flex items-center justify-between gap-3 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
                <Barcode size={16} className="text-blue-600" />
                <span>Быстрый поиск по сканеру штрихкодов:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleBarcodeScanSubmit(e);
                  }}
                  placeholder="Отсканируйте ШК..."
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-mono bg-white focus:ring-2 focus:ring-blue-500 w-44"
                />
                <button
                  type="button"
                  onClick={handleBarcodeScanSubmit}
                  className="rounded-lg bg-blue-600 text-white px-2.5 py-1 text-xs font-semibold hover:bg-blue-700 transition"
                >
                  Добавить
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {rows.map((row, idx) => {
                const item = safeItems.find((i) => i.id === row.selectedItemId);
                const stock = getAvailableStock(item);
                const stockVal = validateStockLimit(row.quantity, stock);

                return (
                  <div
                    key={row.id}
                    className={`rounded-xl border p-3 bg-white space-y-2 transition ${
                      !stockVal.isValid ? "border-rose-300 bg-rose-50/30" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500">Позиция #{idx + 1}</span>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                      <div className="md:col-span-2">
                        <SearchableSelect
                          options={safeItems.map((i) => ({
                            value: i.id,
                            label: `${i.name} (SKU: ${i.sku}) [Остаток: ${getAvailableStock(i)} ${i.unit}]`
                          }))}
                          value={row.selectedItemId}
                          onChange={(val) => updateRow(row.id, { selectedItemId: val })}
                          placeholder="Выберите ТМЦ..."
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="block text-[10px] font-semibold text-slate-500">Количество</label>
                          <span className="text-[10px] text-slate-500 font-bold">Остаток: {stock}</span>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max={stock}
                          value={row.quantity}
                          onChange={(e) => updateRow(row.id, { quantity: parseInt(e.target.value) || 1 })}
                          className={`w-full rounded-lg border px-3 py-1.5 text-xs font-bold ${
                            !stockVal.isValid
                              ? "border-rose-400 text-rose-700 bg-rose-50"
                              : "border-slate-200 text-slate-900"
                          }`}
                        />
                      </div>
                    </div>

                    {!stockVal.isValid && (
                      <div className="text-[10px] text-rose-600 font-semibold">
                        {stockVal.errorMessage}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 pt-1"
            >
              <Plus size={14} />
              <span>Добавить еще позицию</span>
            </button>
          </div>
        )}

        {/* Step 3: Registration */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-blue-900 uppercase">
                <ClipboardList size={16} className="text-blue-600" />
                <span>Итоговая заявка на выдачу</span>
              </div>
              <div><span className="text-slate-500">Откуда:</span> <strong>{header.fromWarehouse}</strong></div>
              <div><span className="text-slate-500">Куда:</span> <strong>{header.toWarehouse}</strong></div>
              <div><span className="text-slate-500">Инициатор:</span> <strong>{header.requestedBy}</strong></div>
              {header.note && <div><span className="text-slate-500">Примечание:</span> <span>{header.note}</span></div>}
            </div>

            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {rows.map((r, i) => {
                const item = safeItems.find((itm) => itm.id === r.selectedItemId);
                return (
                  <div key={r.id} className="p-3 text-xs flex items-center justify-between">
                    <span className="font-bold text-slate-900">{i + 1}. {item?.name} ({item?.sku})</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">{r.quantity} {item?.unit || "шт"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev - 1) as StepType)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Назад
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

            {step === 1 && (
              <button
                type="button"
                onClick={goToStep2}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                Далее: Спецификация
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={goToStep3}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                Далее: Регистрация
              </button>
            )}

            {step === 3 && (
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs disabled:opacity-50 transition"
              >
                <Send size={14} />
                <span>{submitting ? "Отправка..." : "Отправить заявку"}</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
