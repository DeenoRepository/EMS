import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm", className)}>{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return <thead className="[&_tr]:border-b">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="[&_tr:last-child]:border-0">{children}</tbody>;
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr className="border-b transition-colors hover:bg-muted/40">{children}</tr>;
}

export function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn("h-12 px-4 text-left align-middle font-medium text-muted-foreground", className)}>{children}</th>;
}

export function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("p-4 align-middle", className)}>{children}</td>;
}

