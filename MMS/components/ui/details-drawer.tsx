"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type DetailsDrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function DetailsDrawer({ open, title, onClose, children }: DetailsDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex">
      <button type="button" className="flex-1 bg-black/30" onClick={onClose} aria-label="Закрыть" />
      <aside className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button size="sm" variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
        <div className="space-y-2 text-sm">{children}</div>
      </aside>
    </div>
  );
}

