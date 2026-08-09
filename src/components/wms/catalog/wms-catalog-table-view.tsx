"use client";

import React from "react";
import { WmsItem } from "@/types/wms";
import { ViewMode } from "./wms-catalog-smart-filters";
import { StatusBadge } from "@/components/ui";
import { MapPin, Eye, Pencil, QrCode, Cpu, ShieldAlert, ArrowLeftRight, Trash2, Send } from "lucide-react";

interface WmsCatalogTableViewProps {
  items: WmsItem[];
  viewMode: ViewMode;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onViewCard: (item: WmsItem) => void;
  onEdit: (item: WmsItem) => void;
  onPrintLabel: (item: WmsItem) => void;
  canEdit?: boolean;
}

export const WmsCatalogTableView: React.FC<WmsCatalogTableViewProps> = ({
  items,
  viewMode,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onViewCard,
  onEdit,
  onPrintLabel,
  canEdit = true
}) => {
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
          <MapPin size={24} />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">Позиции ТМЦ не найдены</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-sm">
          Попробуйте изменить поисковый запрос, выбрать другую категорию или сбросить активные фильтры.
        </p>
      </div>
    );
  }

  // Рендеринг в режиме карточек (Grid / TSD Mode)
  if (viewMode === "cards") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          const isLow = item.quantity <= item.minQuantity;

          return (
            <div
              key={item.id}
              className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-4 transition-all duration-200 hover:shadow-md ${
                isSelected
                  ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10"
                  : "border-slate-200/80 hover:border-slate-300"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(item.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="font-mono text-xs font-bold text-blue-600 tracking-wide">
                      {item.sku}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.isEps && (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                        EPS
                      </span>
                    )}
                    <StatusBadge
                      status={isLow ? "PENDING" : "APPROVED"}
                      label={isLow ? "Дефицит" : "В наличии"}
                    />
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                    {item.name}
                  </h4>
                  <div className="mt-1 text-[11px] text-slate-500 font-medium">
                    {item.category} • {item.type}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      Остаток
                    </div>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">
                      {item.quantity} {item.unit}
                    </div>
                    {item.reservedQuantity > 0 && (
                      <div className="text-[10px] text-amber-600 font-medium">
                        Резерв: {item.reservedQuantity}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      Ячейка
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-1">
                      <MapPin size={11} className="text-slate-400" />
                      {item.cell || "Не указана"}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium truncate">
                      {item.warehouse}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                <button
                  onClick={() => onViewCard(item)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <Eye size={14} />
                  <span>Карточка</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onPrintLabel(item)}
                    title="Печать QR"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <QrCode size={15} />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => onEdit(item)}
                      title="Редактировать"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Рендеринг в формате таблицы (Компактный или Детальный)
  const isCompact = viewMode === "compact";

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-xs">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <th className="py-3 px-3.5 w-10 text-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </th>
            <th className="py-3 px-3.5">Артикул / SKU</th>
            <th className="py-3 px-3.5">Наименование ТМЦ</th>
            <th className="py-3 px-3.5">Склад & Ячейка</th>
            <th className="py-3 px-3.5">Остаток</th>
            {!isCompact && <th className="py-3 px-3.5">Мин. остаток</th>}
            {!isCompact && <th className="py-3 px-3.5">Категория</th>}
            <th className="py-3 px-3.5">Статус</th>
            <th className="py-3 px-3.5 text-right">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const isLow = item.quantity <= item.minQuantity;

            return (
              <tr
                key={item.id}
                className={`transition-colors hover:bg-slate-50/80 ${
                  isSelected ? "bg-blue-50/20" : ""
                }`}
              >
                <td className="py-2.5 px-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(item.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </td>
                <td className="py-2.5 px-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-blue-600">
                    {item.sku}
                    {item.isEps && (
                      <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800">
                        EPS
                      </span>
                    )}
                  </div>
                  {!isCompact && (item.batchNumber || item.serialNumber) && (
                    <div className="text-[10px] text-slate-400">
                      {item.batchNumber ? `П:${item.batchNumber}` : ""}{" "}
                      {item.serialNumber ? `S/N:${item.serialNumber}` : ""}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3.5">
                  <div className="font-semibold text-slate-900 line-clamp-1">{item.name}</div>
                  {!isCompact && (
                    <div className="text-[10px] text-slate-400">{item.type}</div>
                  )}
                </td>
                <td className="py-2.5 px-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-1 font-mono text-slate-700">
                    <MapPin size={12} className="text-slate-400 shrink-0" />
                    <span>{item.warehouse}</span>
                    <span className="text-slate-400 font-bold">/</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800">
                      {item.cell || "Без ячейки"}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3.5 whitespace-nowrap">
                  <div className="font-bold text-slate-900">
                    {item.quantity} {item.unit}
                  </div>
                  {item.reservedQuantity > 0 && (
                    <div className="text-[10px] text-amber-600 font-medium">
                      Резерв: {item.reservedQuantity}
                    </div>
                  )}
                </td>
                {!isCompact && (
                  <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-500 font-medium">
                    {item.minQuantity} {item.unit}
                  </td>
                )}
                {!isCompact && (
                  <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 font-medium">
                    {item.category}
                  </td>
                )}
                <td className="py-2.5 px-3.5 whitespace-nowrap">
                  <StatusBadge
                    status={isLow ? "PENDING" : "APPROVED"}
                    label={isLow ? "Дефицит" : "В наличии"}
                  />
                </td>
                <td className="py-2.5 px-3.5 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onViewCard(item)}
                      title="Просмотр карточки"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => onPrintLabel(item)}
                      title="Печать этикетки / QR"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <QrCode size={15} />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => onEdit(item)}
                        title="Редактировать"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
