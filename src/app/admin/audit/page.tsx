"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ShellLayout from "@/components/layout/shell-layout";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { LogEntry } from "@/lib/telemetry/logger";
import {
  Gauge,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  SlidersHorizontal,
  Database,
} from "lucide-react";

export default function AuditPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/audit");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8">
        <Breadcrumbs items={[{ label: "Настройки", href: "/admin/settings" }, { label: "Аудит и Мониторинг" }]} />

        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Журнал Аудита & Мониторинг
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Неизменяемый системный реестр событий безопасности, входа пользователей и вызовов API.
            </p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
          </button>
        </div>

        {/* Audit Log Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="hidden grid-cols-[1.5fr_1fr_1.5fr_3fr_1.5fr] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid">
            <span>Время</span>
            <span>Уровень</span>
            <span>Модуль</span>
            <span>Действие</span>
            <span>Пользователь</span>
          </div>

          {logs.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400">
              Записей аудита пока нет или список пуст.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className="grid gap-2 border-b border-slate-100 px-5 py-3 last:border-0 hover:bg-slate-50/50 md:grid-cols-[1.5fr_1fr_1.5fr_3fr_1.5fr] md:items-center md:gap-4 transition text-xs font-mono"
              >
                <div className="text-[10px] text-slate-400">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                <div>
                  <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-[#3473d4]">
                    {log.level.toUpperCase()}
                  </span>
                </div>
                <div className="font-semibold text-[#17243a]">{log.module}</div>
                <div className="text-slate-600 font-sans text-[11px]">{log.action}</div>
                <div className="text-slate-400 text-[10px]">{log.userEmail || "SYSTEM"}</div>
              </div>
            ))
          )}
        </section>
      </main>
    </ShellLayout>
  );
}
