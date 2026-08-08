"use client";

import { useState, useEffect, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import { TimelineEvent } from "@/lib/modules/eps-advanced-store";
import { EquipmentItem } from "@/lib/modules/eps-store";
import { RefreshCw } from "lucide-react";
import {
  PageHeader,
  KpiGrid,
  FilterToolbar,
  DataTable,
  Timeline,
  TabNav,
} from "@/components/ui";

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

  useEffect(() => {
    let isSubscribed = true;
    Promise.resolve().then(() => {
      if (!isSubscribed) return;
      try {
        const saved = localStorage.getItem("eps_events_columns");
        if (saved) {
          setColumns({ ...DEFAULT_COLUMNS, ...JSON.parse(saved) });
        }
      } catch {
        // Игнорируем
      }
    });
    return () => {
      isSubscribed = false;
    };
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

  useEffect(() => {
    let isSubscribed = true;
    Promise.all([
      fetch("/api/modules/eps/events"),
      fetch("/api/modules/eps/equipment"),
    ])
      .then(async ([eventsRes, eqRes]) => {
        if (!isSubscribed) return;
        if (eventsRes.ok) {
          const data = await eventsRes.json();
          setEvents(data.items || []);
        }
        if (eqRes.ok) {
          const eqData = await eqRes.json();
          setEquipmentList(eqData.items || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const fetchEventsData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/modules/eps/events"),
      fetch("/api/modules/eps/equipment"),
    ])
      .then(async ([eventsRes, eqRes]) => {
        if (eventsRes.ok) {
          const data = await eventsRes.json();
          setEvents(data.items || []);
        }
        if (eqRes.ok) {
          const eqData = await eqRes.json();
          setEquipmentList(eqData.items || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

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

  const resetAllFilters = () => {
    setSearchQuery("");
    setEventTypeFilter("ALL");
    setEquipmentFilter("ALL");
  };

  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (searchQuery) chips.push({ id: "q", label: `Поиск: "${searchQuery}"`, onRemove: () => setSearchQuery("") });
    if (eventTypeFilter !== "ALL") chips.push({ id: "t", label: `Тип: ${eventTypeFilter}`, onRemove: () => setEventTypeFilter("ALL") });
    if (equipmentFilter !== "ALL") chips.push({ id: "eq", label: `Оборудование: ${equipmentFilter}`, onRemove: () => setEquipmentFilter("ALL") });
    return chips;
  }, [searchQuery, eventTypeFilter, equipmentFilter]);

  const timelineItems = useMemo(() => {
    return filteredEvents.map((evt) => ({
      id: evt.id,
      date: new Date(evt.createdAt).toLocaleString("ru-RU"),
      user: evt.actor,
      action: evt.title,
      comment: evt.description,
    }));
  }, [filteredEvents]);

  const tableColumns = useMemo(() => {
    const cols = [];
    if (columns.type) {
      cols.push({
        key: "type",
        header: "Тип события",
        cell: (evt: TimelineEvent) => <span className="font-semibold text-slate-700 dark:text-slate-300">{evt.eventType}</span>,
      });
    }
    if (columns.title) {
      cols.push({
        key: "title",
        header: "Наименование / Описание",
        cell: (evt: TimelineEvent) => (
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200">{evt.title}</div>
            <div className="text-[10px] text-slate-400">{evt.description}</div>
          </div>
        ),
      });
    }
    if (columns.equipment) {
      cols.push({
        key: "equipment",
        header: "Оборудование",
        cell: (evt: TimelineEvent) => <span className="font-mono text-[#3473d4]">{evt.equipmentId}</span>,
      });
    }
    if (columns.actor) {
      cols.push({
        key: "actor",
        header: "Автор",
        cell: (evt: TimelineEvent) => <span className="font-medium">{evt.actor}</span>,
      });
    }
    if (columns.createdAt) {
      cols.push({
        key: "createdAt",
        header: "Дата",
        cell: (evt: TimelineEvent) => <span className="font-mono text-slate-400">{new Date(evt.createdAt).toLocaleString("ru-RU")}</span>,
      });
    }
    return cols;
  }, [columns]);

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Журнал изменений EPS"
          description="Аудит версий, статусов и истории коррекций паспортов оборудования"
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "EPS Паспортизация", href: "/modules/eps" },
            { title: "Журнал изменений" },
          ]}
          actions={
            <button
              onClick={fetchEventsData}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
          }
        />

        <KpiGrid
          items={[
            { label: "Всего событий", value: events.length, icon: <RefreshCw size={14} />, iconColor: "blue", sub: "За весь период" },
            { label: "Отфильтровано", value: filteredEvents.length, icon: <RefreshCw size={14} />, iconColor: "emerald", sub: "Текущая выборка" },
          ]}
          columns={2}
        />

        <TabNav
          items={[
            { id: "TIMELINE", label: "Лента версий (Таймлайн)" },
            { id: "TABLE", label: "Табличный реестр аудита" },
          ]}
          activeId={viewMode}
          onChange={(id) => setViewMode(id as "TIMELINE" | "TABLE")}
        />

        <FilterToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Поиск по событию, описанию или автору…"
          filters={[
            {
              key: "type",
              label: "Тип события",
              value: eventTypeFilter,
              onChange: setEventTypeFilter,
              options: [
                { value: "ALL", label: "Все типы событий" },
                { value: "CREATED", label: "Создание" },
                { value: "UPDATED", label: "Изменение" },
                { value: "STATUS_CHANGED", label: "Смена статуса" },
                { value: "DOCUMENT_ATTACHED", label: "Документы" },
              ],
            },
            {
              key: "equipment",
              label: "Оборудование",
              value: equipmentFilter,
              onChange: setEquipmentFilter,
              options: [
                { value: "ALL", label: "Все агрегаты" },
                ...equipmentList.map((eq) => ({ value: eq.equipmentCode, label: `${eq.equipmentCode} (${eq.name})` })),
              ],
            },
          ]}
          columns={[
            { key: "type", label: "Тип события", visible: columns.type },
            { key: "title", label: "Заголовок & Описание", visible: columns.title },
            { key: "equipment", label: "Оборудование", visible: columns.equipment },
            { key: "actor", label: "Автор", visible: columns.actor },
            { key: "createdAt", label: "Дата", visible: columns.createdAt },
          ]}
          onColumnToggle={(key) => toggleColumn(key as keyof EventColumnVisibility)}
          onColumnReset={() => {
            setColumns(DEFAULT_COLUMNS);
            try {
              localStorage.removeItem("eps_events_columns");
            } catch {}
          }}
          activeChips={activeChips}
          onResetAll={resetAllFilters}
        />

        {viewMode === "TIMELINE" ? (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <Timeline items={timelineItems} />
          </div>
        ) : (
          <DataTable
            columns={tableColumns}
            data={filteredEvents}
            keyExtractor={(evt) => evt.id}
            loading={loading}
            emptyText="Записи аудита не найдены."
          />
        )}
      </main>
    </ShellLayout>
  );
}
