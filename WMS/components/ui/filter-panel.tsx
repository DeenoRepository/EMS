import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FilterPanelProps = {
  title?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function FilterPanel({ title, hint, children, className }: FilterPanelProps) {
  return (
    <Card className={cn("p-4", className)}>
      {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      <div className={cn(title || hint ? "mt-3" : "", "grid grid-cols-1 gap-3")}>{children}</div>
    </Card>
  );
}
