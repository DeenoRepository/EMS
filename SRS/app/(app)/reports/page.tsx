"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/states/empty-state";

type ReportHistory = {
  id: string;
  createdAt: string;
  createdBy?: string;
  paramsJson: unknown;
};

export default function Page() {
  const [from, setFrom] = useState("2026-05-01");
  const [to, setTo] = useState("2026-05-31");
  const [groupBy, setGroupBy] = useState<"day" | "month" | "employee" | "equipment">("day");
  const [durationMinutesFrom, setDurationMinutesFrom] = useState("0");
  const [onlyInProgress, setOnlyInProgress] = useState(false);
  const [blockDashboard, setBlockDashboard] = useState(true);
  const [blockDowntime, setBlockDowntime] = useState(true);
  const [blockEmployee, setBlockEmployee] = useState(false);
  const [html, setHtml] = useState("");
  const [history, setHistory] = useState<ReportHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    const res = await fetch("/api/reports?limit=30");
    const data = await res.json();
    setHistory(data?.data ?? []);
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const createReport = async () => {
    setLoading(true);
    const blocks = [
      blockDashboard ? "dashboard" : null,
      blockDowntime ? "downtime" : null,
      blockEmployee ? "employee" : null
    ].filter(Boolean);

    const res = await fetch("/api/reports/html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        groupBy,
        blocks,
        durationMinutesFrom: Number(durationMinutesFrom || "0"),
        onlyInProgress
      })
    });

    const data = await res.json();
    setHtml(data?.data?.html ?? JSON.stringify(data, null, 2));
    await loadHistory();
    setLoading(false);
  };

  const openRun = async (id: string) => {
    const res = await fetch(`/api/reports/${id}`);
    const data = await res.json();
    setHtml(data?.data?.html ?? JSON.stringify(data?.data ?? data, null, 2));
  };

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Отчеты" }]} />
        <h1 className="mt-4 text-3xl font-bold">Отчеты</h1>
        <p className="mt-1 text-muted-foreground">Формирование HTML-отчетов и история запусков.</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Параметры отчета</h2>
            <p className="text-sm text-muted-foreground">Диапазон дат, группировка и блоки отчета.</p>
          </div>
          <Button onClick={createReport} disabled={loading}>{loading ? "Формируется..." : "Сформировать HTML отчет"}</Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">С</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">По</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">Группировка</span>
            <select className="mt-1 w-full rounded border px-2 py-2" value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}>
              <option value="day">day</option>
              <option value="month">month</option>
              <option value="employee">employee</option>
              <option value="equipment">equipment</option>
            </select>
          </label>
          <label className="text-sm"><span className="mb-1 block text-muted-foreground">Фильтр длительности (мин)</span><Input value={durationMinutesFrom} onChange={(e) => setDurationMinutesFrom(e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyInProgress} onChange={(e) => setOnlyInProgress(e.target.checked)} />Только «в процессе»</label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Блоки отчета:</span>
          <label className="flex items-center gap-1"><input type="checkbox" checked={blockDashboard} onChange={(e) => setBlockDashboard(e.target.checked)} />dashboard</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={blockDowntime} onChange={(e) => setBlockDowntime(e.target.checked)} />downtime</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={blockEmployee} onChange={(e) => setBlockEmployee(e.target.checked)} />employee</label>
        </div>

        {html && <iframe className="mt-4 h-[420px] w-full rounded border" srcDoc={html} />}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">История запусков</h2>
          <Button variant="outline" size="sm" onClick={loadHistory}>Обновить</Button>
        </div>
        <div className="mt-3">
          {history.length === 0 ? (
            <EmptyState text="История запусков пока пуста." />
          ) : (
            <div className="divide-y divide-border">
              {history.map((x) => (
                <button key={x.id} className="w-full p-4 text-left transition-colors hover:bg-muted/40" onClick={() => void openRun(x.id)}>
                  <div className="font-medium">Report #{x.id}</div>
                  <div className="text-sm text-muted-foreground">{new Date(x.createdAt).toLocaleString()} | {x.createdBy ?? "system"}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
