"use client";

import { useEffect, useState } from "react";
import { APP_TOAST_EVENT, type NotifyPayload, type NotifyTone } from "@/lib/client/notify";

type ToastItem = NotifyPayload & { id: string };

function toneClasses(tone: NotifyTone) {
  if (tone === "success") return "border-status-success/30 bg-status-success/10";
  if (tone === "error") return "border-status-error/30 bg-status-error/10";
  return "border-border bg-card";
}

export function AppToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<NotifyPayload>).detail;
      if (!detail?.title) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { ...detail, tone: detail.tone || "info", id }]);
      window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 3600);
    };

    window.addEventListener(APP_TOAST_EVENT, onToast);
    return () => window.removeEventListener(APP_TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((item) => (
        <div key={item.id} className={`pointer-events-auto rounded-md border p-3 shadow-sm ${toneClasses(item.tone || "info")}`}>
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          {item.description ? <p className="mt-1 text-xs text-muted-foreground">{item.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
