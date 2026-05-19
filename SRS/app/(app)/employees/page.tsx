"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Summary = {
  totalEmployees: number;
  totalEvents: number;
  inProgress: number;
  peakHour: string | null;
  peakHourEvents: number;
};
type Employee = {
  name: string;
  totalEvents: number;
  inProgress: number;
  avgDowntimeHours: number;
};
type EventItem = {
  id: string;
  responsible: string;
  equipmentTitle: string;
  equipmentUid: string;
  status: string;
  type: string;
  startAt: string;
  endAt?: string | null;
  durationHours: number;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_MINUTES = 24 * 60;
const SHIFT_START = 8 * 60;
const SHIFT_END = 16 * 60 + 30;

function dateShift(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function minuteOfDay(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function isRepair(type: string) {
  return /ремонт|repair/i.test(type || "");
}

function isCancelled(status: string) {
  return /cancelled|canceled|отмен/i.test(status || "");
}

function formatDT(value?: string | null) {
  if (!value) return "Не указано";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Не указано";
  return d.toLocaleString("ru-RU");
}

export default function EmployeesPage() {
  const [from, setFrom] = useState(dateShift(-30));
  const [to, setTo] = useState(dateShift(0));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDay, setSelectedDay] = useState(dateShift(0));
  const [openFilter, setOpenFilter] = useState(false);
  const [openTaskList, setOpenTaskList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ from, to });
      const res = await fetch(`/api/analytics/employees?${q.toString()}`);
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "Ошибка загрузки");
      setSummary(payload.data?.summary ?? null);
      setEmployees(payload.data?.employees ?? []);
      setEvents(payload.data?.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [from, to]);

  const selectedEmployeeItems = useMemo(() => events.filter((x) => x.responsible === selectedEmployee), [events, selectedEmployee]);
  const dayItems = useMemo(() => selectedEmployeeItems.filter((x) => x.startAt.slice(0, 10) === selectedDay), [selectedEmployeeItems, selectedDay]);

  function jumpToTask(id: string) {
    setSelectedTaskId(id);
    setActiveTaskId(id);
    const node = taskRefs.current[id];
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderLane(name: string, items: EventItem[], color: string) {
    return (
      <div className="mb-3" key={name}>
        <div className="mb-1 flex items-center gap-2 text-[11px]">
          <span className={`h-2 w-2 rounded-full ${color}`} />
          <span>{name}</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[1040px]">
            <div className="relative h-11 overflow-hidden rounded border bg-white">
              {HOURS.slice(1).map((h) => (
                <div key={`${name}-g-${h}`} className="absolute bottom-0 top-0 w-px bg-slate-200" style={{ left: `${(h / 24) * 100}%` }} />
              ))}
              <div className="absolute bottom-0 top-0 bg-green-100/40" style={{ left: `${(SHIFT_START / DAY_MINUTES) * 100}%`, width: `${((SHIFT_END - SHIFT_START) / DAY_MINUTES) * 100}%` }} />
              <div className="absolute bottom-0 top-0 w-px bg-green-600/80" style={{ left: `${(SHIFT_START / DAY_MINUTES) * 100}%` }} />
              <div className="absolute bottom-0 top-0 w-px bg-green-600/80" style={{ left: `${(SHIFT_END / DAY_MINUTES) * 100}%` }} />
              {items.map((task) => {
                const fromMin = minuteOfDay(task.startAt);
                const toMin = minuteOfDay(task.endAt);
                if (fromMin == null) return null;
                const left = clamp(Math.min(fromMin, toMin ?? fromMin + 30), 0, 1439);
                const right = clamp(Math.max(fromMin, toMin ?? fromMin + 30), left + 1, 1440);
                const active = activeTaskId === task.id || selectedTaskId === task.id;
                return (
                  <div
                    key={`${name}-${task.id}`}
                    className={`absolute bottom-1 top-1 cursor-pointer rounded-sm ${isCancelled(task.status) ? "bg-slate-400" : color} ${active ? "ring-2 ring-sky-500 ring-offset-1" : ""}`}
                    style={{ left: `${(left / DAY_MINUTES) * 100}%`, width: `${((right - left) / DAY_MINUTES) * 100}%` }}
                    onMouseEnter={() => setActiveTaskId(task.id)}
                    onMouseLeave={() => setActiveTaskId(null)}
                    onClick={() => jumpToTask(task.id)}
                  />
                );
              })}
            </div>
            <div className="relative mt-1 h-4 text-[9px] text-muted-foreground">
              {HOURS.map((h) => (
                <span key={`${name}-h-${h}`} className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${(h / 24) * 100}%` }}>
                  {h.toString().padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="header rounded-xl border bg-white p-4">
        <h1 className="title">Сотрудники</h1>
        <p className="mt-1 text-sm text-muted-foreground">KPI сотрудников и детальный таймлайн работ по выбранному исполнителю.</p>
      </header>

      <section className="card-grid mt-4">
        <article className="card"><div className="metric-label">Сотрудники</div><div className="metric-value">{summary?.totalEmployees ?? 0}</div></article>
        <article className="card"><div className="metric-label">События</div><div className="metric-value">{summary?.totalEvents ?? 0}</div></article>
        <article className="card"><div className="metric-label">В процессе</div><div className="metric-value">{summary?.inProgress ?? 0}</div></article>
        <article className="card"><div className="metric-label">Пиковый час</div><div className="metric-value">{summary?.peakHour ?? "-"}</div><div className="mt-1 text-xs text-muted-foreground">Событий: {summary?.peakHourEvents ?? 0}</div></article>
      </section>

      <section className="card mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Фильтр</div>
          <button className="rounded border px-3 py-1.5 text-xs" onClick={() => setOpenFilter((v) => !v)}>{openFilter ? "Свернуть" : "Развернуть"}</button>
        </div>
        {openFilter ? (
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-xs"><span className="mb-1 block">Период: с</span><input type="date" className="w-full rounded border px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="text-xs"><span className="mb-1 block">Период: по</span><input type="date" className="w-full rounded border px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <label className="text-xs"><span className="mb-1 block">Дата таймлайна</span><input type="date" className="w-full rounded border px-3 py-2" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} /></label>
            <div className="flex items-end"><button className="rounded border px-3 py-2 text-sm" onClick={load} disabled={loading}>{loading ? "Загрузка..." : "Обновить"}</button></div>
          </div>
        ) : null}
        {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      </section>

      <section className="card mt-4">
        <h2 className="mb-2 text-sm font-semibold">Рейтинг сотрудников</h2>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-2 py-2 text-left">Сотрудник</th>
                <th className="px-2 py-2 text-right">События</th>
                <th className="px-2 py-2 text-right">В процессе</th>
                <th className="px-2 py-2 text-right">Средняя длительность, ч</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((x) => (
                <tr key={x.name} className={`cursor-pointer border-t ${selectedEmployee === x.name ? "bg-sky-50" : ""}`} onClick={() => setSelectedEmployee(x.name)}>
                  <td className="px-2 py-2">{x.name}</td>
                  <td className="px-2 py-2 text-right">{x.totalEvents}</td>
                  <td className="px-2 py-2 text-right">{x.inProgress}</td>
                  <td className="px-2 py-2 text-right">{x.avgDowntimeHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Таймлайн работы сотрудника</h2>
          <button className="rounded border px-3 py-1.5 text-xs" onClick={() => setOpenTaskList((v) => !v)}>{openTaskList ? "Скрыть список" : "Показать список"}</button>
        </div>
        {!selectedEmployee ? <p className="text-xs text-muted-foreground">Выберите сотрудника в таблице выше.</p> : null}
        {selectedEmployee ? (
          <>
            <div className="mb-2 text-xs text-muted-foreground">Исполнитель: {selectedEmployee} | Дата: {selectedDay} | Задач: {dayItems.length}</div>
            {renderLane("Ремонт", dayItems.filter((x) => isRepair(x.type)), "bg-red-500")}
            {renderLane("Настройка", dayItems.filter((x) => !isRepair(x.type)), "bg-yellow-500")}
            {openTaskList ? (
              <div className="mt-3 space-y-2">
                {dayItems.map((task) => (
                  <div
                    key={task.id}
                    ref={(n) => { taskRefs.current[task.id] = n; }}
                    className={`rounded border p-2 text-xs ${activeTaskId === task.id || selectedTaskId === task.id ? "border-sky-500 bg-sky-50" : ""}`}
                    onMouseEnter={() => setActiveTaskId(task.id)}
                    onMouseLeave={() => setActiveTaskId(null)}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{task.type}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px]">{task.status}</span>
                    </div>
                    <div>{task.equipmentTitle} ({task.equipmentUid})</div>
                    <div className="text-muted-foreground">Начало: {formatDT(task.startAt)} | Окончание: {formatDT(task.endAt)}</div>
                    <div className="text-muted-foreground">Длительность: {task.durationHours?.toFixed(2) ?? "0"} ч</div>
                  </div>
                ))}
                {dayItems.length === 0 ? <p className="text-xs text-muted-foreground">По выбранному сотруднику событий нет.</p> : null}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </>
  );
}

