"use client";

import { useState, useEffect, useCallback } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  PageHeader,
  Button,
} from "@/components/ui";
import { LogEntry } from "@/lib/telemetry/logger";
import { RefreshCw } from "lucide-react";

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
    void (async () => {
      await fetchLogs();
    })();
  }, [fetchLogs]);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Журнал аудита"
          description="Неизменяемый системный реестр событий безопасности, входа пользователей и вызовов API."
          breadcrumbs={[
            { title: "Администрирование", href: "/admin/settings" },
            { title: "Аудит" },
          ]}
          actions={
            <Button
              onClick={fetchLogs}
              disabled={loading}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </Button>
          }
        />

        {/* Audit Log Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="hidden grid-cols-[1.5fr_1fr_1.5fr_3fr_1.5fr] gap-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 dark:text-slate-500 md:grid">
            <span>Время</span>
            <span>Уровень</span>
            <span>Модуль</span>
            <span>Действие</span>
            <span>Пользователь</span>
          </div>

          {logs.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400 dark:text-slate-500">
              Записей аудита пока нет или список пуст.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className="grid gap-2 border-b border-slate-100 dark:border-slate-800 px-5 py-3 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 md:grid-cols-[1.5fr_1fr_1.5fr_3fr_1.5fr] md:items-center md:gap-4 transition text-xs font-mono"
              >
                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                <div>
                  <span className="inline-flex rounded-full bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[9px] font-bold text-[#3473d4] dark:text-blue-400">
                    {log.level.toUpperCase()}
                  </span>
                </div>
                <div className="font-semibold text-[#17243a] dark:text-slate-200">{log.module}</div>
                <div className="text-slate-600 dark:text-slate-300 font-sans text-[11px]">{log.action}</div>
                <div className="text-slate-400 dark:text-slate-500 text-[10px]">{log.userEmail || "SYSTEM"}</div>
              </div>
            ))
          )}
        </section>
      </main>
    </ShellLayout>
  );
}
