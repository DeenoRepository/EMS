"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Action = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string[];
};

const ACTIONS: Action[] = [
  { id: "wms-home", title: "Открыть WMS Dashboard", subtitle: "Панель показателей склада", href: "/wms", keywords: ["dashboard", "главная", "панель"] },
  { id: "wms-items", title: "Номенклатура", subtitle: "Список SKU и карточек", href: "/wms/items", keywords: ["sku", "позиции", "номенклатура"] },
  { id: "wms-items-new", title: "Новая позиция", subtitle: "Создать карточку номенклатуры", href: "/wms/items/new", keywords: ["создать", "новая", "позиция"] },
  { id: "wms-warehouses", title: "Склады", subtitle: "Справочник складов и локаций", href: "/wms/warehouses", keywords: ["склады", "локации"] },
  { id: "wms-movements", title: "Движения", subtitle: "Приход, выдача, перемещение", href: "/wms/movements", keywords: ["движения", "приход", "выдача"] },
  { id: "wms-reservations", title: "Резервы", subtitle: "Резервирование под MMS", href: "/wms/reservations", keywords: ["резервы", "mms", "заявка"] },
  { id: "wms-balances", title: "Остатки", subtitle: "Контроль доступного остатка", href: "/wms/balances", keywords: ["остатки", "available", "low stock"] },
  { id: "wms-analytics", title: "Аналитика", subtitle: "Сводка и тренды склада", href: "/wms/analytics", keywords: ["аналитика", "тренд", "kpi"] }
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIONS;
    return ACTIONS.filter((a) => [a.title, a.subtitle, ...a.keywords].join(" ").toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      if (ctrlOrMeta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 p-4" onClick={() => setOpen(false)}>
      <div className="mx-auto mt-20 w-full max-w-2xl rounded-xl border border-border bg-card p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Быстрые действия</p>
          <p className="text-xs text-muted-foreground">Ctrl+K</p>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти страницу или действие..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/30 focus:ring"
        />
        <div className="mt-3 max-h-80 overflow-auto rounded-md border border-border">
          {filtered.map((item) => (
            <button
              key={item.id}
              className="w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
              onClick={() => {
                setOpen(false);
                router.push(item.href);
              }}
            >
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.subtitle}</p>
            </button>
          ))}
          {filtered.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">Ничего не найдено</p> : null}
        </div>
      </div>
    </div>
  );
}

