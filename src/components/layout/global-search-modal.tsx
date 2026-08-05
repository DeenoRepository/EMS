"use client";

import { useState, useEffect } from "react";
import { Search, Command, ArrowRight, Zap, Shield, Cpu, Sliders, Box, FileText, BarChart3, ClipboardCheck, Activity, Wrench, PackageCheck, Database, Gauge } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShell } from "./shell-context";
import { NAV_ITEMS, NavItem } from "@/lib/config/nav";
import { APP_VERSION } from "@/lib/version";

interface FlatSearchItem {
  id: string;
  title: string;
  category: string;
  href: string;
  keywords: string[];
  icon: React.ReactNode;
}

function getIconForName(name?: string, category?: string): React.ReactNode {
  switch (name) {
    case "LayoutDashboard":
      return <Zap className="h-3.5 w-3.5 text-sky-500" />;
    case "Server":
    case "Box":
      return <Cpu className="h-3.5 w-3.5 text-indigo-500" />;
    case "FileText":
      return <FileText className="h-3.5 w-3.5 text-slate-400" />;
    case "BarChart3":
      return <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />;
    case "ClipboardCheck":
      return <ClipboardCheck className="h-3.5 w-3.5 text-blue-400" />;
    case "Activity":
      return <Activity className="h-3.5 w-3.5 text-purple-400" />;
    case "Zap":
      return <Zap className="h-3.5 w-3.5 text-amber-500" />;
    case "Wrench":
      return <Wrench className="h-3.5 w-3.5 text-amber-500" />;
    case "PackageCheck":
      return <PackageCheck className="h-3.5 w-3.5 text-cyan-400" />;
    case "Database":
      return <Database className="h-3.5 w-3.5 text-indigo-400" />;
    case "ShieldCheck":
      return <Shield className="h-3.5 w-3.5 text-indigo-400" />;
    case "Gauge":
      return <Gauge className="h-3.5 w-3.5 text-rose-400" />;
    case "SlidersHorizontal":
      return <Sliders className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return <Command className="h-3.5 w-3.5 text-primary" />;
  }
}

function buildSearchItems(): FlatSearchItem[] {
  const items: FlatSearchItem[] = [];

  const traverse = (item: NavItem) => {
    items.push({
      id: item.id,
      title: item.title,
      category: item.category,
      href: item.href,
      keywords: item.keywords,
      icon: getIconForName(item.iconName, item.category),
    });

    if (item.children) {
      item.children.forEach(traverse);
    }
  };

  NAV_ITEMS.forEach(traverse);
  return items;
}

const ALL_SEARCH_ITEMS = buildSearchItems();

export function GlobalSearchModal() {
  const router = useRouter();
  const { searchModalOpen: open, setSearchModalOpen: setOpen } = useShell();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = query
    ? ALL_SEARCH_ITEMS.filter((i) => {
        const q = query.toLowerCase();
        return (
          i.title.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.keywords.some((kw) => kw.toLowerCase().includes(q))
        );
      })
    : ALL_SEARCH_ITEMS;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setOpen]);

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      const target = filtered[selectedIndex];
      setOpen(false);
      router.push(target.href);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Палитра команд и глобальный поиск"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleModalKeyDown}
            className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center border-b border-border px-4 py-3 bg-card">
              <Search className="h-4 w-4 text-primary mr-3 shrink-0" aria-hidden="true" />
              <input
                type="text"
                autoFocus
                placeholder="Поиск маршрутов, команд и параметров (стрелки ↑↓ для выбора)…"
                aria-label="Поисковый запрос"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={() => setOpen(false)}
                aria-label="Закрыть поиск"
                className="text-[11px] font-mono text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
              >
                Esc
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Совпадающих команд или маршрутов не найдено</div>
              ) : (
                filtered.map((item, idx) => {
                  const isSelected = idx === selectedIndex;

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
                          : "hover:bg-accent hover:text-accent-foreground text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.icon}
                        <span className="truncate">{item.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                            isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.category}
                        </span>
                        <ArrowRight className={`h-3 w-3 ${isSelected ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2 border-t border-border bg-muted/40 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <div className="flex items-center gap-2">
                <span>↑↓ навигация</span>
                <span>•</span>
                <span>↵ выбор</span>
              </div>
              <span>Command Palette v{APP_VERSION}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
