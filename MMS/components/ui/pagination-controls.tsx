"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";

type PaginationControlsProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextSize: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
  label?: string;
};

export function PaginationControls({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  disabled = false,
  label = "Записей"
}: PaginationControlsProps) {
  const safePage = Math.min(Math.max(1, page), Math.max(1, pageCount));
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(total, safePage * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
      <p className="text-sm text-muted-foreground">
        {label}: {from}-{to} из {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <AppSelect
          value={String(pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={disabled}
          className="w-[96px]"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}/стр
            </option>
          ))}
        </AppSelect>
        <Button size="sm" variant="outline" disabled={disabled || safePage <= 1} onClick={() => onPageChange(1)}>
          Первая
        </Button>
        <Button size="sm" variant="outline" disabled={disabled || safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          Назад
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Страница</span>
          <Input
            value={String(safePage)}
            onChange={(e) => {
              const next = Number(e.target.value || "1");
              if (Number.isFinite(next) && next >= 1 && next <= pageCount) onPageChange(next);
            }}
            className="h-9 w-[68px]"
            inputMode="numeric"
            disabled={disabled}
          />
          <span>из {pageCount}</span>
        </div>
        <Button size="sm" variant="outline" disabled={disabled || safePage >= pageCount} onClick={() => onPageChange(safePage + 1)}>
          Далее
        </Button>
        <Button size="sm" variant="outline" disabled={disabled || safePage >= pageCount} onClick={() => onPageChange(pageCount)}>
          Последняя
        </Button>
      </div>
    </div>
  );
}
