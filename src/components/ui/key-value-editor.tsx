"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface KeyValueEditorProps {
  value: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = "Характеристика",
  valuePlaceholder = "Значение",
  addLabel = "Добавить характеристику",
  disabled = false,
  className,
}: KeyValueEditorProps) {
  const handleAdd = () => {
    onChange([...value, { key: "", value: "" }]);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: "key" | "value", val: string) => {
    const updated = value.map((pair, i) => (i === index ? { ...pair, [field]: val } : pair));
    onChange(updated);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {value.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-1">Нет добавленных характеристик</p>
      ) : (
        value.map((pair, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={pair.key}
              onChange={(e) => handleChange(idx, "key", e.target.value)}
              placeholder={keyPlaceholder}
              disabled={disabled}
              className="flex-1"
            />
            <Input
              value={pair.value}
              onChange={(e) => handleChange(idx, "value", e.target.value)}
              placeholder={valuePlaceholder}
              disabled={disabled}
              className="flex-1"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
                title="Удалить"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))
      )}
      {!disabled && (
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3473d4] dark:text-blue-400 hover:underline pt-1"
        >
          <Plus size={13} />
          {addLabel}
        </button>
      )}
    </div>
  );
}
