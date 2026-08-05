"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import ShellLayout from "@/components/layout/shell-layout";
import { TimelineEvent } from "@/lib/modules/eps-advanced-store";
import { EquipmentItem } from "@/lib/modules/eps-store";
import {
  ChevronRight,
  User,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Columns3,
  RotateCcw,
  X,
  Calendar,
  Layers,
  History,
  FileText,
  Activity,
  CheckCircle2,
  List,
  LayoutList,
  Server,
} from "lucide-react";

export interface EventColumnVisibility {
  type: boolean;
  title: boolean;
  equipment: boolean;
  actor: boolean;
  createdAt: boolean;
}

const DEFAULT_COLUMNS: EventColumnVisibility = {
  type: true,
  title: true,
  equipment: true,
  actor: true,
  createdAt: true,
};

const EVENT_TYPE_CONFIG: Record<
  TimelineEvent["eventType"],
  { label: string; bg: string; text: string; border: string; icon: React.ElementType }
> = {
  CREATED: { label: "Создание", bg: "bg-[#eef5ff]", text: "text-[#3473d4]", border: "border-blue-200", icon: Server },
  UPDATED: { label: "Изменение", bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200", icon: Activity },
  STATUS_CHANGED: { label: "Смена статуса", bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", icon: CheckCircle2 },
  DOCUMENT_ATTACHED: { label: "Документ", bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200", icon: FileText },
  APPROVAL_SUBMITTED: { label: "Согласование", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", icon: History },
  APPROVAL_RESOLVED: { label: "Решение", bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-200", icon: CheckCircle2 },
};

export default function ChangeHistoryPage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("ALL");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"TIMELINE" | "TABLE">("TIMELINE");

  // Column visibility state with localStorage persistence
  const [columns, setColumns] = useState<EventColumnVisibility>(DEFAULT_COLUMNS);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("eps_events_columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        setColumns({ ...DEFAULT_COLUMNS, ...parsed });
      }
    } catch {
      // Игнорируем ошибки чтения localStorage
    }
  }, []);

  const toggleColumn = (key: keyof EventColumnVisibility) => {
    setColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("eps_events_columns", JSON.stringify(updated));
      } catch {
        // Игнорируем
      }
      return updated;
    });
  };

  const fetchEventsData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, eqRes] = await Promise.all([
        fetch("/api/modules/eps/events"),
        fetch("/api/modules/eps/equipment"),
      ]);

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data.items || []);
      }

      if (eqRes.ok) {
        const eqData = await eqRes.json();
        setEquipmentList(eqData.items || []);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEventsData();
  }, [fetchEventsData]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        evt.title.toLowerCase().includes(q) ||
        evt.description.toLowerCase().includes(q) ||
        evt.actor.toLowerCase().includes(q) ||
        evt.equipmentId.toLowerCase().includes(q);

      const matchesType = eventTypeFilter === "ALL" || evt.eventType === eventTypeFilter;
      const matchesEq = equipmentFilter === "ALL" || evt.equipmentId === equipmentFilter;

      return matchesQuery && matchesType && matchesEq;
    });
  }, [events, searchQuery, eventTypeFilter, equipmentFilter]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim() !== "") count++;
    if (eventTypeFilter !== "ALL") count++;
    if (equipmentFilter !== "ALL") count++;
    return count;
  }, [searchQuery, eventTypeFilter, equipmentFilter]);

  const resetAllFilters = () => {
    setSearchQuery("");
    setEventTypeFilter("ALL");
    setEquipmentFilter("ALL");
  };

  // Dynamic grid template calculation based on visible columns
  const gridTemplateClass = useMemo(() => {
    const parts: string[] = [];
    if (columns.type) parts.push("1.2fr");
    if (columns.title) parts.push("2.5fr");
    if (columns.equipment) parts.push("1.5fr");
    if (columns.actor) parts.push("1.5fr");
    if (columns.createdAt) parts.push("1.5fr");

    if (parts.length === 0) return "1fr";
    return parts.join(" ");
  }, [columns]);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        {/* Breadcrumbs & Page Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <Link href="/" className="hover:text-slate-600">Главная</Link>
              <ChevronRight size={12} />
              <Link href="/modules/eps" className="hover:text-slate-600">EPS Паспортизация</Link>
              <ChevronRight size={12} />
              <span className="text-[#3473d4]">История изменений</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              История изменений
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Хронологическая лента версий оборудования, статусов и документов (найдено {filteredEvents.length} из {events.length} событий).
            </p>
          </div>

          <div className="flex gap-2 items-center">
            {/* View Switcher */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-slate-600">
              <button
                onClick={() => setViewMode("TIMELINE")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  viewMode === "TIMELINE"
                    ? "bg-white text-[#3473d4] shadow-2xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <LayoutList size={13} /> Лента
              </button>
              <button
                onClick={() => setViewMode("TABLE")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  viewMode === "TABLE"
                    ? "bg-white text-[#3473d4] shadow-2xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <List size={13} /> Таблица
              </button>
            </div>

            <button
              onClick={fetchEventsData}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
          </div>
        </div>

        {/* Filter Toolbar & Column Customizer */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск по наименованию события, описанию или автору…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-[#f8fafc] pl-9 pr-8 text-[11px] outline-none placeholder:text-slate-400 focus:border-[#3c82ed] focus:ring-2 focus:ring-blue-100"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Controls & Column Selector */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1 text-[#3473d4]">
                <SlidersHorizontal size={13} />
                <span className="font-semibold text-[11px]">Фильтры:</span>
              </div>

              {/* Event Type Select */}
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                  eventTypeFilter !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                    : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                }`}
              >
                <option value="ALL">Все типы событий</option>
                <option value="CREATED">Создание оборудования</option>
                <option value="UPDATED">Обновление параметров</option>
                <option value="STATUS_CHANGED">Смена статуса</option>
                <option value="DOCUMENT_ATTACHED">Прикрепление документа</option>
                <option value="APPROVAL_SUBMITTED">Заявка на согласование</option>
              </select>

              {/* Equipment Select */}
              <select
                value={equipmentFilter}
                onChange={(e) => setEquipmentFilter(e.target.value)}
                className={`h-8 rounded-lg border px-2.5 text-[10px] outline-none transition ${
                  equipmentFilter !== "ALL"
                    ? "border-[#3c82ed] bg-blue-50/50 text-[#3473d4] font-semibold"
                    : "border-slate-200 bg-[#f8fafc] text-slate-600 focus:border-[#3c82ed]"
                }`}
              >
                <option value="ALL">Всё оборудование</option>
                {equipmentList.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.equipmentCode} ({eq.name})
                  </option>
                ))}
              </select>

              {/* Column Selector (Table View only) */}
              {viewMode === "TABLE" && (
                <div className="relative">
                  <button
                    onClick={() => setShowColumnMenu((prev) => !prev)}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50"
                  >
                    <Columns3 size={13} className="text-[#3473d4]" />
                    <span>Колонки</span>
                  </button>

                  {showColumnMenu && (
                    <div
                      className="absolute right-0 top-10 z-30 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-xl space-y-2 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-[#17243a] text-[11px]">Колонки таблицы</span>
                        <button
                          onClick={() => setShowColumnMenu(false)}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={columns.type}
                            onChange={() => toggleColumn("type")}
                            className="rounded border-slate-300 text-[#3473d4]"
                          />
                          <span>Тип события</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={columns.title}
                            onChange={() => toggleColumn("title")}
                            className="rounded border-slate-300 text-[#3473d4]"
                          />
                          <span>Событие & Описание</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={columns.equipment}
                            onChange={() => toggleColumn("equipment")}
                            className="rounded border-slate-300 text-[#3473d4]"
                          />
                          <span>Техника (ID)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={columns.actor}
                            onChange={() => toggleColumn("actor")}
                            className="rounded border-slate-300 text-[#3473d4]"
                          />
                          <span>Автор</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 hover:bg-slate-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={columns.createdAt}
                            onChange={() => toggleColumn("createdAt")}
                            className="rounded border-slate-300 text-[#3473d4]"
                          />
                          <span>Дата и время</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Active Filter Chips */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-xs px-1">
              <span className="text-[10px] font-semibold text-slate-400">Активные фильтры:</span>

              {searchQuery && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                  Поиск: "{searchQuery}"
                  <button onClick={() => setSearchQuery("")} className="hover:text-blue-800">
                    <X size={11} />
                  </button>
                </span>
              )}

              {eventTypeFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100">
                  Тип: {eventTypeFilter}
                  <button onClick={() => setEventTypeFilter("ALL")} className="hover:text-blue-800">
                    <X size={11} />
                  </button>
                </span>
              )}

              {equipmentFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3473d4] border border-blue-100 font-mono">
                  ID техники: {equipmentFilter}
                  <button onClick={() => setEquipmentFilter("ALL")} className="hover:text-blue-800">
                    <X size={11} />
                  </button>
                </span>
              )}

              <button
                onClick={resetAllFilters}
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700 ml-1"
              >
                <RotateCcw size={10} /> Сбросить все
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area: Timeline View or Table View */}
        {viewMode === "TIMELINE" ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            {filteredEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <p>{loading ? "Загрузка событий..." : "События по заданным критериям не найдены."}</p>
                {activeFiltersCount > 0 && (
                  <button onClick={resetAllFilters} className="text-[11px] font-semibold text-[#3473d4] hover:underline">
                    Сбросить все фильтры
                  </button>
                )}
              </div>
            ) : (
              <ol className="relative border-l border-slate-200 ml-4 space-y-6">
                {filteredEvents.map((evt) => {
                  const cfg = EVENT_TYPE_CONFIG[evt.eventType] || EVENT_TYPE_CONFIG.UPDATED;
                  const Icon = cfg.icon;

                  return (
                    <li key={evt.id} className="ml-6">
                      {/* Timeline Dot Icon */}
                      <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${cfg.bg} ${cfg.text} shadow-2xs`}>
                        <Icon size={12} />
                      </span>

                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 hover:shadow-xs transition">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                              {cfg.label}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              ID Оборудования: <span className="font-semibold text-slate-600">{evt.equipmentId}</span>
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(evt.createdAt).toLocaleString("ru-RU")}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-bold text-xs text-[#17243a]">{evt.title}</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{evt.description}</p>
                        </div>

                        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-medium text-slate-500">
                            <User size={12} className="text-slate-400" /> Инициатор: {evt.actor}
                          </div>
                          <span className="font-mono text-[9px] text-slate-400">{evt.id}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        ) : (
          /* Table View */
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
            <div
              className="hidden gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid"
              style={{ gridTemplateColumns: gridTemplateClass }}
            >
              {columns.type && <span>Тип события</span>}
              {columns.title && <span>Событие & Описание</span>}
              {columns.equipment && <span>ID Оборудования</span>}
              {columns.actor && <span>Автор</span>}
              {columns.createdAt && <span>Дата и время</span>}
            </div>

            {filteredEvents.length === 0 ? (
              <div className="px-5 py-12 text-center text-xs text-slate-400 space-y-2">
                <p>События по заданным критериям не найдены.</p>
                {activeFiltersCount > 0 && (
                  <button onClick={resetAllFilters} className="text-[11px] font-semibold text-[#3473d4] hover:underline">
                    Сбросить все фильтры
                  </button>
                )}
              </div>
            ) : (
              filteredEvents.map((evt) => {
                const cfg = EVENT_TYPE_CONFIG[evt.eventType] || EVENT_TYPE_CONFIG.UPDATED;

                return (
                  <div
                    key={evt.id}
                    className="grid gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 hover:bg-slate-50/50 md:items-center md:gap-4 transition text-xs"
                    style={{ gridTemplateColumns: gridTemplateClass }}
                  >
                    {columns.type && (
                      <div>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </div>
                    )}

                    {columns.title && (
                      <div>
                        <span className="block font-semibold text-[#17243a] text-[12px]">{evt.title}</span>
                        <span className="block text-[10px] text-slate-400 line-clamp-1 mt-0.5">{evt.description}</span>
                      </div>
                    )}

                    {columns.equipment && (
                      <div className="text-[11px] font-bold text-[#3473d4] font-mono">
                        {evt.equipmentId}
                      </div>
                    )}

                    {columns.actor && (
                      <div className="text-[10px] text-slate-600 flex items-center gap-1.5">
                        <User size={12} className="text-slate-400" />
                        <span className="font-semibold">{evt.actor}</span>
                      </div>
                    )}

                    {columns.createdAt && (
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                        <Calendar size={12} className="text-slate-400" />
                        {new Date(evt.createdAt).toLocaleString("ru-RU")}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        )}
      </main>
    </ShellLayout>
  );
}
