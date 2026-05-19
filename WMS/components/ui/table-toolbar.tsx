import type { ReactNode } from "react";
import { FilterPanel } from "@/components/ui/filter-panel";
import { cn } from "@/lib/utils";

type TableToolbarProps = {
  title?: string;
  hint?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function TableToolbar({ title, hint, children, actions, className }: TableToolbarProps) {
  return (
    <FilterPanel title={title} hint={hint} className={className}>
      <div className="grid grid-cols-1 gap-3">{children}</div>
      {actions ? <div className={cn("mt-1 flex flex-wrap gap-2", className)}>{actions}</div> : null}
    </FilterPanel>
  );
}
