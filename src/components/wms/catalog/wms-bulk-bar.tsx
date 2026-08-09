"use client";

import React from "react";
import { PackageCheck, ArrowLeftRight, Trash2, Send, QrCode, X } from "lucide-react";

interface WmsBulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onTransfer: () => void;
  onWriteOff: () => void;
  onRequisition: () => void;
  onPrintLabels?: () => void;
  canEdit?: boolean;
}

export const WmsBulkActionBar: React.FC<WmsBulkActionBarProps> = ({
  selectedCount,
  onClearSelection,
  onTransfer,
  onWriteOff,
  onRequisition,
  onPrintLabels,
  canEdit = true
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/95 px-4 py-3 text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
        <PackageCheck className="h-5 w-5 text-blue-400" />
        <span className="text-xs font-semibold">
          Выбрано: <span className="font-bold text-blue-400">{selectedCount}</span>
        </span>
        <button
          onClick={onClearSelection}
          className="ml-1 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          title="Сбросить выделение"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {canEdit && (
          <>
            <button
              onClick={onRequisition}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-indigo-500 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Запросить перемещение</span>
            </button>

            <button
              onClick={onTransfer}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-500 transition-colors"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Переместить</span>
            </button>

            <button
              onClick={onWriteOff}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600/90 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-rose-600 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Списать</span>
            </button>
          </>
        )}

        {onPrintLabels && (
          <button
            onClick={onPrintLabels}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>Этикетки</span>
          </button>
        )}
      </div>
    </div>
  );
};
