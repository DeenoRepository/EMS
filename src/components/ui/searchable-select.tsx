"use client";

import * as React from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectItem {
  id: string;
  name: string;
  sku?: string;
  quantity?: number;
  unit?: string;
  warehouse?: string;
}

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  // Legacy / Direct Object format
  items?: SearchableSelectItem[];
  selectedId?: string;
  onSelect?: (item: SearchableSelectItem) => void;

  // Key-Value options format
  options?: SearchableSelectOption[];
  value?: string;
  onChange?: (value: string) => void;

  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  items,
  selectedId,
  onSelect,
  options,
  value,
  onChange,
  placeholder = "Введите для поиска...",
  className,
  disabled = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Normalize options/items list to a unified format
  const normalizedList = React.useMemo(() => {
    if (options && Array.isArray(options)) {
      return options.map((opt) => ({
        id: opt.value,
        name: opt.label,
        sku: "",
        quantity: undefined,
        unit: undefined,
        warehouse: undefined,
      }));
    }
    if (items && Array.isArray(items)) {
      return items;
    }
    return [];
  }, [options, items]);

  const activeId = selectedId !== undefined ? selectedId : value !== undefined ? value : "";

  const selectedItem = React.useMemo(() => {
    return normalizedList.find((i) => i.id === activeId);
  }, [normalizedList, activeId]);

  // Sync input value with selectedItem when closed
  React.useEffect(() => {
    if (!isOpen) {
      if (selectedItem) {
        setSearchQuery(selectedItem.name);
      } else {
        setSearchQuery("");
      }
    }
  }, [selectedItem, isOpen]);

  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim() || (selectedItem && searchQuery === selectedItem.name)) {
      return normalizedList;
    }
    const q = searchQuery.toLowerCase().trim();
    return normalizedList.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.warehouse && item.warehouse.toLowerCase().includes(q))
    );
  }, [normalizedList, searchQuery, selectedItem]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChoose = (item: SearchableSelectItem) => {
    if (onSelect) {
      onSelect(item);
    }
    if (onChange) {
      onChange(item.id);
    }
    setSearchQuery(item.name);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div className="relative flex items-center">
        <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={searchQuery}
          onChange={(e) => {
            if (disabled) return;
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (disabled) return;
            setIsOpen(true);
            if (selectedItem && searchQuery === selectedItem.name) {
              inputRef.current?.select();
            }
          }}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-slate-300 bg-white pl-8 pr-8 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs font-medium",
            disabled && "cursor-not-allowed opacity-50 bg-slate-100"
          )}
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setIsOpen(true);
              inputRef.current?.focus();
            }}
            className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
          >
            <X size={13} />
          </button>
        ) : (
          <ChevronDown size={14} className="absolute right-3 text-slate-400 pointer-events-none" />
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl space-y-1 text-xs">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-2 text-slate-400 text-center text-[11px]">
              Ничего не найдено
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleChoose(item)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between gap-2",
                    isSelected
                      ? "bg-blue-50 text-blue-900 font-semibold"
                      : "hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 truncate">
                      <span>{item.name}</span>
                      {item.sku && (
                        <span className="font-mono text-[10px] text-blue-600 font-bold bg-blue-50 border border-blue-100 px-1 rounded shrink-0">
                          {item.sku}
                        </span>
                      )}
                    </div>
                    {(item.quantity !== undefined || item.warehouse) && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-2">
                        {item.quantity !== undefined && (
                          <span>
                            Доступно:{" "}
                            <strong className="text-slate-700 font-mono">
                              {item.quantity} {item.unit || "шт"}
                            </strong>
                          </span>
                        )}
                        {item.warehouse && <span>| Склад: {item.warehouse}</span>}
                      </div>
                    )}
                  </div>
                  {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
