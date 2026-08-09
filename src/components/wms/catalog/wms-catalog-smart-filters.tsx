"use client";

import React from "react";
import { AlertTriangle, ShieldAlert, Cpu, PackageX, LayoutList, AlignJustify, LayoutGrid } from "lucide-react";

export type ViewMode = "compact" | "detailed" | "cards";

export type SmartFilterPreset = "ALL" | "LOW_STOCK" | "PPE" | "EPS" | "NO_CELL";

interface WmsCatalogSmartFiltersProps {
  activePreset: SmartFilterPreset;
  onSelectPreset: (preset: SmartFilterPreset) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  counts: {
    total: number;
    lowStock: number;
    ppe: number;
    eps: number;
    noCell: number;
  };
}

export const WmsCatalogSmartFilters: React.FC<WmsCatalogSmartFiltersProps> = ({
  activePreset,
  onSelectPreset,
  viewMode,
  onViewModeChange,
  counts
}) => {
  const presets: { id: SmartFilterPreset; label: string; icon: React.ReactNode; count: number; badgeColor: string }[] = [
    {
      id: "ALL",
      label: "Все позиции",
      icon: null,
      count: counts.total,
      badgeColor: "bg-slate-100 text-slate-700"
    },
    {
      id: "LOW_STOCK",
      label: "Дефицит",
      icon: <AlertTriangle size={13} className="text-rose-500" />,
      count: counts.lowStock,
      badgeColor: counts.lowStock > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
    },
    {
      id: "EPS",
      label: "ЗиП ЭПС / ТОиР",
      icon: <Cpu size={13} className="text-amber-600" />,
      count: counts.eps,
      badgeColor: "bg-amber-100 text-amber-800"
    },
    {
      id: "PPE",
      label: "СИЗ / Спецодежда",
      icon: <ShieldAlert size={13} className="text-indigo-600" />,
      count: counts.ppe,
      badgeColor: "bg-indigo-100 text-indigo-700"
    },
    {
      id: "NO_CELL",
      label: "Без ячейки",
      icon: <PackageX size={13} className="text-slate-500" />,
      count: counts.noCell,
      badgeColor: "bg-slate-100 text-slate-600"
    }
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-xs">
      {/* Смарт-чипсы экспресс-фильтрации */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2">
          Быстрый фильтр:
        </span>
        {presets.map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
              }`}
            >
              {preset.icon}
              <span>{preset.label}</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  isActive ? "bg-white/20 text-white" : preset.badgeColor
                }`}
              >
                {preset.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Переключатель режима вида (Компактный / Детальный / Карточки) */}
      <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 border border-slate-200/60">
        <button
          onClick={() => onViewModeChange("compact")}
          title="Компактный вид (для быстрой работы со списком)"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
            viewMode === "compact"
              ? "bg-white text-blue-600 shadow-2xs font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <AlignJustify size={14} />
          <span className="hidden sm:inline">Компактный</span>
        </button>

        <button
          onClick={() => onViewModeChange("detailed")}
          title="Детальная таблица со всеми полями"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
            viewMode === "detailed"
              ? "bg-white text-blue-600 shadow-2xs font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <LayoutList size={14} />
          <span className="hidden sm:inline">Детальный</span>
        </button>

        <button
          onClick={() => onViewModeChange("cards")}
          title="Карточный режим (удобно для планшетов и TSD)"
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
            viewMode === "cards"
              ? "bg-white text-blue-600 shadow-2xs font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <LayoutGrid size={14} />
          <span className="hidden sm:inline">Плитка</span>
        </button>
      </div>
    </div>
  );
};
