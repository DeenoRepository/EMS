"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";

type HeatItem = { date: string; count: number };
type FilterOptions = {
  statuses: string[];
  types: string[];
  responsibles: string[];
  subdivisions: string[];
  equipment: string[];
};
type DayItem = {
  id: string;
  equipmentUid: string;
  equipmentTitle: string;
  factoryNumber?: string;
  subdivision?: string;
  startAt: string;
  endAt?: string;
  type: string;
  status: string;
  responsible?: string;
  jiraIssueKey?: string;
  description?: string;
  comments?: string;
};

type EquipmentRow = {
  key: string;
  equipmentUid: string;
  equipmentTitle: string;
  subdivision: string;
  factoryNumber: string;
  items: DayItem[];
};

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_MINUTES = 24 * 60;
const SHIFT_START = 8 * 60;
const SHIFT_END = 16 * 60 + 30;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function minuteOfDay(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function toColor(count: number, max: number) {
  if (count <= 0) return "rgb(241,245,249)";
  if (max <= 1) return "rgb(134,239,172)";
  const t = (count - 1) / Math.max(1, max - 1);
  if (t < 0.45) return "rgb(134,239,172)";
  if (t < 0.75) return "rgb(250,204,21)";
  return "rgb(239,68,68)";
}

function isCancelled(status: string) {
  return /cancelled|canceled|отмен/i.test(status || "");
}

function isRepair(type: string) {
  return /ремонт|repair/i.test(type || "");
}

function formatDT(value?: string) {
  if (!value) return "Не указано";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Не указано";
  return d.toLocaleString("ru-RU");
}

function formatDuration(start?: string, end?: string) {
  if (!start) return "Не указано";
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "Не указано";
  const mins = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
  return `${Math.floor(mins / 60)} ч ${(mins % 60).toString().padStart(2, "0")} мин`;
}

export default function FailuresPage() {
  const [selectedDay, setSelectedDay] = useState(todayISO());
  const [anchorDate, setAnchorDate] = useState(todayISO());
  const [items, setItems] = useState<HeatItem[]>([]);
  const [dayItems, setDayItems] = useState<DayItem[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({ statuses: [], types: [], responsibles: [], subdivisions: [], equipment: [] });

  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [responsible, setResponsible] = useState("");
  const [subdivision, setSubdivision] = useState("");
  const [equipment, setEquipment] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [modalKey, setModalKey] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const year = Number(anchorDate.slice(0, 4));
  const maxCount = useMemo(() => Math.max(0, ...items.map((x) => x.count)), [items]);
  const byDate = useMemo(() => new Map(items.map((x) => [x.date, x.count])), [items]);

  async function safeJson(res: Response) {
    const txt = await res.text();
    if (!txt) return {};
    try {
      return JSON.parse(txt);
    } catch {
      return {};
    }
  }

  async function loadFilterLists() {
    const res = await fetch("/api/analytics/filters");
    const payload = await safeJson(res);
    if (res.ok && payload.ok) setFilters(payload.data);
  }

  async function loadHeat() {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({
        mode: "FAILURES",
        period: "day",
        from: `${year}-01-01`,
        to: `${year}-12-31`,
      });
      if (status) q.set("status", status);
      if (type) q.set("type", type);
      if (responsible) q.set("responsible", responsible);
      if (subdivision) q.set("subdivision", subdivision);
      if (equipment) q.set("equipment", equipment);

      const res = await fetch(`/api/analytics/heatmap?${q.toString()}`);
      const payload = await safeJson(res);
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "Ошибка загрузки карты тепла");
      setItems(payload.data?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  async function loadDay(date: string) {
    const q = new URLSearchParams({ date });
    if (status) q.set("status", status);
    if (type) q.set("type", type);
    if (responsible) q.set("responsible", responsible);
    if (subdivision) q.set("subdivision", subdivision);
    if (equipment) q.set("equipment", equipment);
    const res = await fetch(`/api/analytics/downtime/day?${q.toString()}`);
    const payload = await safeJson(res);
    setDayItems(payload.data ?? []);
  }

  useEffect(() => {
    void loadFilterLists();
  }, []);

  useEffect(() => {
    void loadHeat();
    void loadDay(selectedDay);
  }, [status, type, responsible, subdivision, equipment, anchorDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const equipmentRows = useMemo(() => {
    const map = new Map<string, EquipmentRow>();
    for (const item of dayItems) {
      const key = `${item.equipmentUid}::${item.equipmentTitle}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          equipmentUid: item.equipmentUid,
          equipmentTitle: item.equipmentTitle,
          subdivision: item.subdivision || "Не указана",
          factoryNumber: item.factoryNumber || "Не указан",
          items: [],
        });
      }
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [dayItems]);

  const selectedEquipment = useMemo(() => equipmentRows.find((x) => x.key === modalKey) || null, [equipmentRows, modalKey]);

  function jumpToTask(taskId: string) {
    setSelectedTaskId(taskId);
    setActiveTaskId(taskId);
    const node = cardRefs.current[taskId];
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderTimeline(itemsToRender: DayItem[], compact = false) {
    const repairs = itemsToRender.filter((x) => isRepair(x.type));
    const setups = itemsToRender.filter((x) => !isRepair(x.type));

    const lane = (name: string, data: DayItem[], color: string) => (
      <div className={compact ? "mb-2" : "mb-3"} key={name}>
        <div className="mb-1 flex items-center gap-2 text-[11px]">
          <span className={`h-2 w-2 rounded-full ${color}`} />
          <span>{name}</span>
        </div>
        <div className="overflow-x-auto">
          <div className={compact ? "min-w-[1040px]" : "min-w-[1000px]"}>
            <div className={`${compact ? "h-10" : "h-12"} relative overflow-hidden rounded border bg-white`}>
              {HOURS.slice(1).map((h) => (
                <div key={`${name}-grid-${h}`} className="absolute bottom-0 top-0 w-px bg-slate-200" style={{ left: `${(h / 24) * 100}%` }} />
              ))}
              <div className="absolute bottom-0 top-0 bg-green-100/40" style={{ left: `${(SHIFT_START / DAY_MINUTES) * 100}%`, width: `${((SHIFT_END - SHIFT_START) / DAY_MINUTES) * 100}%` }} />
              <div className="absolute bottom-0 top-0 w-px bg-green-600/80" style={{ left: `${(SHIFT_START / DAY_MINUTES) * 100}%` }} />
              <div className="absolute bottom-0 top-0 w-px bg-green-600/80" style={{ left: `${(SHIFT_END / DAY_MINUTES) * 100}%` }} />

              {data.map((task) => {
                const from = minuteOfDay(task.startAt);
                const to = minuteOfDay(task.endAt);
                if (from == null) return null;
                const left = clamp(Math.min(from, to ?? from + 30), 0, 1439);
                const right = clamp(Math.max(from, to ?? from + 30), left + 1, 1440);
                const active = activeTaskId === task.id || selectedTaskId === task.id;
                return (
                  <div
                    key={`${name}-${task.id}`}
                    className={`absolute bottom-1 top-1 cursor-pointer rounded-sm ${isCancelled(task.status) ? "bg-slate-400" : color} ${active ? "ring-2 ring-sky-500 ring-offset-1" : ""}`}
                    style={{ left: `${(left / DAY_MINUTES) * 100}%`, width: `${((right - left) / DAY_MINUTES) * 100}%` }}
                    title={`Исполнитель: ${task.responsible || "Не указан"}\nНачало: ${formatDT(task.startAt)}\nОкончание: ${formatDT(task.endAt)}\nДлительность: ${formatDuration(task.startAt, task.endAt)}\nПричина: ${task.description || "Не указана"}`}
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

    return (
      <>
        {lane("Ремонт", repairs, "bg-red-500")}
        {lane("Настройка", setups, "bg-yellow-500")}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Простои оборудования" }]} />
        <h1 className="mt-4 text-3xl font-bold">Простои оборудования</h1>
        <p className="mt-1 text-muted-foreground">Карта тепла, фильтры и таймлайны работ по выбранному дню.</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Фильтр</h2>
            <p className="text-sm text-muted-foreground">Год, статусы, типы работ, исполнители и оборудование.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsFilterOpen((v) => !v)}>{isFilterOpen ? "Свернуть" : "Развернуть"}</Button>
        </div>
        {isFilterOpen ? (
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <label className="text-xs md:col-span-2"><span className="mb-1 block text-muted-foreground">Год</span><input type="date" className="w-full rounded border px-3 py-2" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} /></label>
            <label className="text-xs md:col-span-2"><span className="mb-1 block text-muted-foreground">Статус</span><select className="w-full rounded border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Все статусы</option>{filters.statuses.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="text-xs md:col-span-2"><span className="mb-1 block text-muted-foreground">Тип</span><select className="w-full rounded border px-3 py-2" value={type} onChange={(e) => setType(e.target.value)}><option value="">Все типы</option>{filters.types.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="text-xs md:col-span-2"><span className="mb-1 block text-muted-foreground">Исполнитель</span><select className="w-full rounded border px-3 py-2" value={responsible} onChange={(e) => setResponsible(e.target.value)}><option value="">Все исполнители</option>{filters.responsibles.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="text-xs md:col-span-2"><span className="mb-1 block text-muted-foreground">Группа</span><select className="w-full rounded border px-3 py-2" value={subdivision} onChange={(e) => setSubdivision(e.target.value)}><option value="">Все группы</option>{filters.subdivisions.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="text-xs md:col-span-2"><span className="mb-1 block text-muted-foreground">Оборудование</span><Input className="w-full" list="equipment-options" value={equipment} onChange={(e) => setEquipment(e.target.value)} /><datalist id="equipment-options">{filters.equipment.map((x) => <option key={x} value={x} />)}</datalist></label>
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Диапазон: 1 - {maxCount}</span>
          <span>{loading ? "Обновление..." : `Выбрано: ${selectedDay}`}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {MONTHS.map((m, idx) => {
            const days = new Date(year, idx + 1, 0).getDate();
            return (
              <div key={m} className="rounded border p-2">
                <div className="mb-2 text-xs font-semibold">{m}</div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: days }).map((_, dIndex) => {
                    const date = `${year}-${String(idx + 1).padStart(2, "0")}-${String(dIndex + 1).padStart(2, "0")}`;
                    const count = byDate.get(date) || 0;
                    return (
                      <button
                        key={date}
                        className={`relative h-9 rounded text-[10px] ${selectedDay === date ? "ring-2 ring-sky-500" : ""}`}
                        style={{ backgroundColor: toColor(count, maxCount) }}
                        onClick={() => {
                          setSelectedDay(date);
                          void loadDay(date);
                        }}
                        title={`${date}: ${count}`}
                      >
                        <span className="absolute right-1 top-0.5 text-[9px]">{dIndex + 1}</span>
                        <span className="absolute inset-x-0 bottom-0.5 text-center font-semibold">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Оборудование за день</h2>
            <p className="text-sm text-muted-foreground">{selectedDay} • Карточек: {equipmentRows.length}</p>
          </div>
        </div>
        <div className="mt-3">
          {error ? <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
          <div className="space-y-3">
            {equipmentRows.map((row) => (
              <button key={row.key} className="w-full rounded border p-3 text-left text-xs hover:bg-muted/20" onClick={() => setModalKey(row.key)}>
                <div className="grid gap-3 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <div className="mb-1 text-[11px] text-muted-foreground">Наименование оборудования</div>
                    <div className="font-semibold">{row.equipmentTitle}</div>
                    <div className="mt-2 text-[11px] text-muted-foreground">Инвентарный номер</div>
                    <div className="font-semibold">{row.equipmentUid}</div>
                    <div className="mt-2 text-[11px] text-muted-foreground">Группа обслуживания</div>
                    <div className="font-semibold">{row.subdivision}</div>
                  </div>
                  <div className="md:col-span-9">{renderTimeline(row.items, true)}</div>
                </div>
              </button>
            ))}
            {equipmentRows.length === 0 && <EmptyState text="По выбранной дате событий нет." />}
          </div>
        </div>
      </Card>

      {selectedEquipment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalKey(null)}>
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Детализация установки: {selectedEquipment.equipmentTitle}</h3>
              <Button variant="outline" size="sm" onClick={() => setModalKey(null)}>Закрыть</Button>
            </div>
            <div className="mb-4 grid gap-3 text-sm md:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">Инвентарный номер</div><div className="font-semibold">{selectedEquipment.equipmentUid}</div></div>
              <div><div className="text-xs text-muted-foreground">Заводской номер</div><div className="font-semibold">{selectedEquipment.factoryNumber}</div></div>
              <div><div className="text-xs text-muted-foreground">Группа</div><div className="font-semibold">{selectedEquipment.subdivision}</div></div>
              <div><div className="text-xs text-muted-foreground">Событий за день</div><div className="font-semibold">{selectedEquipment.items.length}</div></div>
            </div>
            {renderTimeline(selectedEquipment.items)}

            <h4 className="mb-2 mt-4 text-sm font-semibold">Детализированное описание задач</h4>
            <div className="space-y-2">
              {selectedEquipment.items.map((task) => (
                <div
                  key={task.id}
                  ref={(n) => { cardRefs.current[task.id] = n; }}
                  className={`rounded border p-2 text-xs ${selectedTaskId === task.id || activeTaskId === task.id ? "border-sky-500 bg-sky-50" : ""}`}
                  onMouseEnter={() => setActiveTaskId(task.id)}
                  onMouseLeave={() => setActiveTaskId(null)}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{task.type}</span>
                    <Badge className="bg-slate-100">{task.status}</Badge>
                    <Badge className="bg-blue-50 text-blue-700">{task.jiraIssueKey || "без Jira key"}</Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>Исполнитель: {task.responsible || "Не указан"}</div>
                    <div>Длительность: {formatDuration(task.startAt, task.endAt)}</div>
                    <div>Начало: {formatDT(task.startAt)}</div>
                    <div>Окончание: {formatDT(task.endAt)}</div>
                  </div>
                  <div className="mt-1">Причина: {task.description || "Не указана"}</div>
                  {task.comments ? <div className="mt-1 text-muted-foreground whitespace-pre-wrap">{task.comments}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

