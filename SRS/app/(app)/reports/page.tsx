"use client";

import { useEffect, useState } from "react";

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
    <>
      <header className="header"><h1 className="title">Отчеты</h1></header>
      <div className="card space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <label className="text-sm">С <input type="date" className="ml-2 rounded border px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-sm">По <input type="date" className="ml-2 rounded border px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="text-sm">Группировка
            <select className="ml-2 rounded border px-2 py-1" value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}>
              <option value="day">day</option>
              <option value="month">month</option>
              <option value="employee">employee</option>
              <option value="equipment">equipment</option>
            </select>
          </label>
          <label className="text-sm">Фильтр длительности (мин)
            <input className="ml-2 w-24 rounded border px-2 py-1" value={durationMinutesFrom} onChange={(e) => setDurationMinutesFrom(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyInProgress} onChange={(e) => setOnlyInProgress(e.target.checked)} />Только «в процессе»</label>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Блоки отчета:</span>
          <label className="flex items-center gap-1"><input type="checkbox" checked={blockDashboard} onChange={(e) => setBlockDashboard(e.target.checked)} />dashboard</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={blockDowntime} onChange={(e) => setBlockDowntime(e.target.checked)} />downtime</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={blockEmployee} onChange={(e) => setBlockEmployee(e.target.checked)} />employee</label>
        </div>

        <button className="rounded bg-primary px-3 py-2 text-primary-foreground" onClick={createReport} disabled={loading}>{loading ? "Формируется..." : "Сформировать HTML отчет"}</button>
        <iframe className="h-[420px] w-full rounded border" srcDoc={html} />

        <div className="rounded border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">История запусков</h3>
            <button className="rounded border px-2 py-1 text-xs" onClick={loadHistory}>Обновить</button>
          </div>
          <div className="space-y-2">
            {history.map((x) => (
              <button key={x.id} className="w-full rounded border p-2 text-left text-xs hover:bg-muted" onClick={() => void openRun(x.id)}>
                <div className="font-semibold">Report #{x.id}</div>
                <div>{new Date(x.createdAt).toLocaleString()} | {x.createdBy ?? "system"}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
