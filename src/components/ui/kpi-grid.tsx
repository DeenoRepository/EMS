import * as React from "react";
import { KpiCard, KpiCardProps } from "./kpi-card";
import { cn } from "@/lib/utils";

export interface KpiGridProps {
  items: Array<Omit<KpiCardProps, "className"> & { id?: string }>;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function KpiGrid({ items, columns = 4, className }: KpiGridProps) {
  const gridColsClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
  }[columns];

  return (
    <div className={cn("grid gap-3.5", gridColsClass, className)}>
      {items.map((item, idx) => (
        <KpiCard key={item.id || idx} {...item} />
      ))}
    </div>
  );
}
