"use client";

import React, { useState } from "react";
import { Modal, ModalHeader } from "@/components/ui";
import { Box, MapPin, Tag, ShieldCheck, QrCode, Printer, Layers, Barcode } from "lucide-react";
import { WmsItem } from "@/types/wms";
import { BarcodeLabelModal } from "../barcode-label-modal";

interface ItemCardDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: WmsItem | null;
  onEdit?: (item: WmsItem) => void;
}

type TabType = "specs" | "topology" | "batches" | "label";

export function ItemCardDetailsModal({
  isOpen,
  onClose,
  item,
  onEdit
}: ItemCardDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("specs");
  const [showPrintLabelModal, setShowPrintLabelModal] = useState(false);

  if (!isOpen || !item) return null;

  const totalValue = (item.quantity || 0) * (item.unitPrice || 0);

  return (
    <Modal open={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        icon={<Box size={18} className="text-blue-600" />}
        title={`Складская карточка ТМЦ: ${item.name}`}
        subtitle={`Артикул / SKU: ${item.sku}`}
        onClose={onClose}
      />

      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
        <button
          type="button"
          onClick={() => setActiveTab("specs")}
          className={`flex items-center gap-1.5 py-3 px-4 text-xs font-semibold border-b-2 transition ${
            activeTab === "specs"
              ? "border-blue-600 text-blue-600 bg-white shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Layers size={14} />
          <span>1. Характеристики</span>
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
          <span>2. Топология & Остатки</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("batches")}
          className={`flex items-center gap-1.5 py-3 px-4 text-xs font-semibold border-b-2 transition ${
            activeTab === "batches"
              ? "border-blue-600 text-blue-600 bg-white shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Tag size={14} />
          <span>3. Партии и Резервы</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("label")}
          className={`flex items-center gap-1.5 py-3 px-4 text-xs font-semibold border-b-2 transition ${
            activeTab === "label"
              ? "border-blue-600 text-blue-600 bg-white shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <QrCode size={14} />
          <span>4. Штрихкод и Печать</span>
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Tab 1: Specs */}
        {activeTab === "specs" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Наименование:</span>
              <div className="font-bold text-slate-900">{item.name}</div>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Артикул / SKU:</span>
              <div className="font-mono font-bold text-blue-600">{item.sku}</div>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Категория:</span>
              <div className="font-semibold text-slate-800">{item.category}</div>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Тип номенклатуры:</span>
              <div className="font-semibold text-slate-800">{item.type || "ЗИП"}</div>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Единица измерения:</span>
              <div className="font-semibold text-slate-800">{item.unit || "шт"}</div>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Цена за единицу:</span>
              <div className="font-bold text-emerald-700">
                {item.unitPrice ? `${item.unitPrice.toLocaleString("ru-RU")} ₽` : "Не указана"}
              </div>
            </div>

            {item.isEps && (
              <div className="col-span-2 md:col-span-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-800 font-semibold">
                <ShieldCheck size={16} className="text-amber-600" />
                <span>Неснижаемый запас критического оборудования (EPS / ТОиР)</span>
              </div>
            )}

            {item.description && (
              <div className="col-span-2 md:col-span-3 pt-2 border-t border-slate-200">
                <span className="text-slate-500 block mb-1">Описание / Заметки:</span>
                <p className="text-slate-700 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                  {item.description}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Topology */}
        {activeTab === "topology" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Закрепленный склад:</span>
                <div className="font-bold text-slate-900">{item.warehouse}</div>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Зона топологии:</span>
                <div className="font-semibold text-slate-800">{item.zone || "Зона А"}</div>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Ячейка хранения:</span>
                <div className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">
                  {item.cell || "Яч-01"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <span className="text-slate-500 block mb-0.5">Текущий остаток</span>
                <div className="text-lg font-bold text-slate-900">
                  {item.quantity} {item.unit}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <span className="text-slate-500 block mb-0.5">Минимальный порог</span>
                <div className="text-lg font-bold text-amber-600">
                  {item.minQuantity} {item.unit}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <span className="text-slate-500 block mb-0.5">Стоимость запаса</span>
                <div className="text-lg font-bold text-emerald-700">
                  {totalValue > 0 ? `${totalValue.toLocaleString("ru-RU")} ₽` : "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Batches & Reserves */}
        {activeTab === "batches" && (
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Номер партии (Batch №):</span>
              <div className="font-mono font-bold text-slate-900">
                {item.batchNumber || "Определяется автоматически"}
              </div>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Серийный номер (S/N):</span>
              <div className="font-mono font-bold text-slate-900">
                {item.serialNumber || "Без серийного номера"}
              </div>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Зарезервированное количество:</span>
              <div className="font-bold text-amber-700">
                {item.reservedQuantity || 0} {item.unit}
              </div>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Свободный остаток:</span>
              <div className="font-bold text-blue-700">
                {Math.max(0, (item.quantity || 0) - (item.reservedQuantity || 0))} {item.unit}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Label Preview */}
        {activeTab === "label" && (
          <div className="text-center space-y-4 py-2">
            <div className="inline-block rounded-xl border-2 border-dashed border-slate-300 p-4 bg-white shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EMS WMS LABEL</div>
              <div className="font-bold text-sm text-slate-900 my-1">{item.name}</div>
              <div className="font-mono text-xs font-bold text-blue-600 mb-2">{item.sku}</div>
              <div className="flex justify-center my-2">
                <Barcode size={48} className="text-slate-800" />
              </div>
              <div className="text-[10px] font-mono text-slate-600">Ячейка: {item.cell || item.warehouse}</div>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setShowPrintLabelModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Printer size={14} /> Печать на термопринтере (58x40 мм)
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-200">
          <div>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(item);
                }}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
              >
                Редактировать карточку
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
          >
            Закрыть
          </button>
        </div>
      </div>

      {/* Embedded Barcode Label Print Modal */}
      {showPrintLabelModal && (
        <BarcodeLabelModal
          open={showPrintLabelModal}
          onClose={() => setShowPrintLabelModal(false)}
          title="Печать этикетки ТМЦ"
          sku={item.sku}
          name={item.name}
          location={item.cell || item.warehouse}
          category={item.category}
        />
      )}
    </Modal>
  );
}
