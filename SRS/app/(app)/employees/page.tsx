"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";

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

function statusTone(status: string) {
  if (/cancel|canceled|cancelled|отмен/i.test(status)) return "bg-slate-100 text-slate-700 border-slate-200";
  if (/resolved|done|closed|решен|заверш/i.test(status)) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (/ожидание поддержки|waiting.*support|support/i.test(status)) return "bg-violet-100 text-violet-700 border-violet-200";
  if (/ожидание|pending|queued/i.test(status)) return "bg-blue-100 text-blue-700 border-blue-200";
  if (/progress|в работе|in progress/i.test(status)) return "bg-amber-100 text-amber-800 border-amber-200";
  if (/blocked|блок/i.test(status)) return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-sky-100 text-sky-700 border-sky-200";
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

  if (loading) return <LoadingState text="Загрузка данных сотрудников..." />;
  if (error) return <ErrorState text={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Сотрудники" }]} />
        <h1 className="mt-4 text-3xl font-bold">Сотрудники</h1>
        <p className="mt-1 text-muted-foreground">KPI сотрудников и детальный таймлайн работ по выбранному исполнителю.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Сотрудники" value={summary?.totalEmployees ?? 0} />
        <KpiCard label="События" value={summary?.totalEvents ?? 0} />
        <KpiCard label="В процессе" value={summary?.inProgress ?? 0} />
        <KpiCard label="Пиковый час" value={summary?.peakHour ?? "-"} hint={`${summary?.peakHourEvents ?? 0} событий`} />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Фильтр</h2>
            <p className="text-sm text-muted-foreground">Период анализа и дата таймлайна.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpenFilter((v) => !v)}>{openFilter ? "Свернуть" : "Развернуть"}</Button>
        </div>
        {openFilter && (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="text-sm"><span className="mb-1 block text-muted-foreground">Период: с</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted-foreground">Период: по</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <label className="text-sm"><span className="mb-1 block text-muted-foreground">Дата таймлайна</span><Input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} /></label>
            <div className="flex items-end"><Button variant="outline" onClick={load}>Обновить</Button></div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Рейтинг сотрудников</h2>
        </div>
        <div className="mt-3">
          {employees.length === 0 ? (
            <EmptyState text="Нет данных по сотрудникам за выбранный период." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Сотрудник</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">События</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">В процессе</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Средняя длительность, ч</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((x) => (
                    <tr key={x.name} className={`cursor-pointer border-b transition-colors hover:bg-muted/40 ${selectedEmployee === x.name ? "bg-sky-50" : ""}`} onClick={() => setSelectedEmployee(x.name)}>
                      <td className="p-4 align-middle font-medium">{x.name}</td>
                      <td className="p-4 text-right align-middle">{x.totalEvents}</td>
                      <td className="p-4 text-right align-middle">{x.inProgress}</td>
                      <td className="p-4 text-right align-middle">{x.avgDowntimeHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Таймлайн работы сотрудника</h2>
            {selectedEmployee && <p className="text-sm text-muted-foreground">{selectedEmployee} • {selectedDay} • {dayItems.length} задач</p>}
          </div>
          {selectedEmployee && (
            <Button variant="outline" size="sm" onClick={() => setOpenTaskList((v) => !v)}>{openTaskList ? "Скрыть список" : "Показать список"}</Button>
          )}
        </div>
        {!selectedEmployee && <p className="text-sm text-muted-foreground">Выберите сотрудника в таблице выше.</p>}
        {selectedEmployee && (
          <>
            {dayItems.length === 0 ? (
              <EmptyState text="По выбранному сотруднику и дате событий нет." />
            ) : (
              <>
                {renderLane("Ремонт", dayItems.filter((x) => isRepair(x.type)), "bg-red-500")}
                {renderLane("Настройка", dayItems.filter((x) => !isRepair(x.type)), "bg-yellow-500")}
              </>
            )}
            {openTaskList && selectedEmployee && (
              <div className="mt-3 space-y-2">
                {dayItems.map((task) => (
                  <div
                    key={task.id}
                    ref={(n) => { taskRefs.current[task.id] = n; }}
                    className={`rounded border p-3 text-sm ${activeTaskId === task.id || selectedTaskId === task.id ? "border-sky-500 bg-sky-50" : ""}`}
                    onMouseEnter={() => setActiveTaskId(task.id)}
                    onMouseLeave={() => setActiveTaskId(null)}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{task.type}</span>
                      <Badge className={`rounded-full border ${statusTone(task.status)}`}>{task.status}</Badge>
                    </div>
                    <p>{task.equipmentTitle} ({task.equipmentUid})</p>
                    <p className="text-muted-foreground">Начало: {formatDT(task.startAt)} | Окончание: {formatDT(task.endAt)}</p>
                    <p className="text-muted-foreground">Длительность: {task.durationHours?.toFixed(2) ?? "0"} ч</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
