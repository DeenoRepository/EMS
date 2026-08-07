"use client";

import * as React from "react";
import { Input, InputProps } from "./input";
import { cn } from "@/lib/utils";

export interface AutocompleteOption<T = unknown> {
  id: string | number;
  label: string;
  sublabel?: string;
  data?: T;
}

export interface AutocompleteInputProps extends Omit<InputProps, "value" | "onChange" | "onSelect"> {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  onSelect: (option: AutocompleteOption) => void;
  minSearchLength?: number;
  className?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  options,
  onSelect,
  minSearchLength = 2,
  className,
  ...props
}: AutocompleteInputProps) {
  const [userClosed, setUserClosed] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filteredOptions = React.useMemo(() => {
    if (value.trim().length < minSearchLength) return [];
    const query = value.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(query))
    );
  }, [value, options, minSearchLength]);

  const isOpen = !userClosed && filteredOptions.length > 0;

  const handleInputChange = (val: string) => {
    setUserClosed(false);
    onChange(val);
  };

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setUserClosed(true);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <Input
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setUserClosed(false)}
        {...props}
      />
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl space-y-1 text-xs">
          {filteredOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onSelect(opt);
                setUserClosed(true);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">{opt.label}</div>
              {opt.sublabel && <div className="text-[10px] text-slate-400">{opt.sublabel}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
