"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DetailsDrawer } from "@/components/ui/details-drawer";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { notifyError, notifySuccess } from "@/lib/client/notify";

type Task = {
  id: string;
  equipmentId: string;
  maintenanceType: "PREVENTIVE" | "SEASONAL" | "CAPITAL" | "DIAGNOSTIC";
  scheduledDate: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "OVERDUE";
  resultNotes?: string | null;
};

type EquipmentRef = {
  id: string;
  equipmentCode?: string | null;
  name: string;
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };
type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

type TaskWithFlags = Task & {
  priority: Priority;
  priorityRank: number;
  slaLabel: string;
  slaClass: string;
  overdueDays: number;
};

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU");
}

function daysTo(dateValue: string) {
  const now = new Date();
  const target = new Date(dateValue);
  const dayMs = 24 * 60 * 60 * 1000;
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetUtc - nowUtc) / dayMs);
}

function getTaskFlags(task: Task): TaskWithFlags {
  const days = daysTo(task.scheduledDate);
  const overdueDays = days < 0 ? Math.abs(days) : 0;

  if (task.status === "COMPLETED") {
    return {
      ...task,
      priority: "LOW",
      priorityRank: 4,
      slaLabel: "Выполнено",
      slaClass: "text-status-success",
      overdueDays
    };
  }

  if (task.status === "CANCELED") {
    return {
      ...task,
      priority: "LOW",
      priorityRank: 4,
      slaLabel: "Отменено",
      slaClass: "text-muted-foreground",
      overdueDays
    };
  }

  if (task.status === "OVERDUE" || days < 0) {
    return {
      ...task,
      priority: overdueDays > 3 ? "CRITICAL" : "HIGH",
      priorityRank: overdueDays > 3 ? 1 : 2,
      slaLabel: `SLA нарушен (${overdueDays} дн.)`,
      slaClass: "text-status-error",
      overdueDays
    };
  }

  if (days === 0) {
    return {
      ...task,
      priority: "HIGH",
      priorityRank: 2,
      slaLabel: "Дедлайн сегодня",
      slaClass: "text-status-warning",
      overdueDays
    };
  }

  if (days === 1) {
    return {
      ...task,
      priority: "HIGH",
      priorityRank: 2,
      slaLabel: "Дедлайн завтра",
      slaClass: "text-status-warning",
      overdueDays
    };
  }

  if (days <= 7 || task.status === "IN_PROGRESS") {
    return {
      ...task,
      priority: "MEDIUM",
      priorityRank: 3,
      slaLabel: `До дедлайна ${days} дн.`,
      slaClass: "text-status-info",
      overdueDays
    };
  }

  return {
    ...task,
    priority: "LOW",
    priorityRank: 4,
    slaLabel: `До дедлайна ${days} дн.`,
    slaClass: "text-muted-foreground",
    overdueDays
  };
}

export default function OperationsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("all");
  const [maintenanceType, setMaintenanceType] = useState("all");
  const [q, setQ] = useState("");
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(20);
  const [submitting, setSubmitting] = useState(false);

  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [equipmentItems, setEquipmentItems] = useState<EquipmentRef[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false);
  const [syncingEquipment, setSyncingEquipment] = useState(false);

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("IN_PROGRESS");
  const [bulkDate, setBulkDate] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [slaPreset, setSlaPreset] = useState("all");
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);

  const [form, setForm] = useState({
    equipmentId: "",
    scheduledDate: new Date().toISOString().slice(0, 10),
    maintenanceType: "PREVENTIVE",
    laborHours: "",
    totalCost: "",
    resultNotes: ""
  });

  const taskPageCount = useMemo(() => Math.max(1, Math.ceil(tasksTotal / taskPageSize)), [tasksTotal]);

  const prioritizedTasks = useMemo(() => {
    return tasks
      .map(getTaskFlags)
      .sort((a, b) => {
        if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
        if (a.overdueDays !== b.overdueDays) return b.overdueDays - a.overdueDays;
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
      });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return prioritizedTasks.filter((task) => {
      const isOpenTask = task.status !== "COMPLETED" && task.status !== "CANCELED";
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (slaPreset === "breached" && !(isOpenTask && (task.status === "OVERDUE" || task.overdueDays > 0))) return false;
      if (slaPreset === "due_today" && !(isOpenTask && daysTo(task.scheduledDate) === 0)) return false;
      return true;
    });
  }, [prioritizedTasks, priorityFilter, slaPreset]);

  const allOnPageSelected = filteredTasks.length > 0 && filteredTasks.every((item) => selectedTaskIds.includes(item.id));
  const drawerTask = filteredTasks.find((item) => item.id === drawerTaskId) || null;

  const taskStats = useMemo(() => {
    const planned = tasks.filter((t) => t.status === "PLANNED").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const overdue = tasks.filter((t) => t.status === "OVERDUE").length;
    return { planned, inProgress, completed, overdue };
  }, [tasks]);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(taskPage), pageSize: String(taskPageSize), q });
      if (status !== "all") params.set("status", status);
      if (maintenanceType !== "all") params.set("maintenanceType", maintenanceType);
      const res = await fetch(`/api/maintenance/tasks?${params.toString()}`);
      if (!res.ok) {
        setError("Не удалось загрузить операции ТОиР");
        return;
      }
      const data = (await res.json()) as Paged<Task>;
      setTasks(data.items || []);
      setTasksTotal(data.total || 0);
      setSelectedTaskIds([]);
    } catch {
      setError("Сетевая ошибка при загрузке операций ТОиР");
    } finally {
      setLoading(false);
    }
  };

  const loadEquipment = async () => {
    setEquipmentLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "80" });
      if (equipmentQuery.trim()) params.set("q", equipmentQuery.trim());
      const res = await fetch(`/api/integrations/eps/synced-equipment?${params.toString()}`);
      if (!res.ok) {
        setEquipmentItems([]);
        return;
      }
      const data = (await res.json()) as Paged<EquipmentRef>;
      setEquipmentItems(data.items || []);
    } catch {
      setEquipmentItems([]);
    } finally {
      setEquipmentLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, [status, q, maintenanceType, taskPage, taskPageSize]);

  useEffect(() => {
    void loadEquipment();
  }, [equipmentQuery]);

  const syncEquipment = async () => {
    setSyncingEquipment(true);
    try {
      const res = await fetch("/api/integrations/eps/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageSize: 100, maxPages: 200 })
      });
      const data = (await res.json()) as { error?: string; upserted?: number };
      if (!res.ok) {
        notifyError(data.error || "Не удалось синхронизировать оборудование");
        return;
      }
      notifySuccess("Синхронизация завершена", `Загружено/обновлено: ${data.upserted || 0}`);
      await loadEquipment();
    } catch {
      notifyError("Ошибка синхронизации оборудования");
    } finally {
      setSyncingEquipment(false);
    }
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.equipmentId.trim()) {
      notifyError("Выберите оборудование из синхронизированного реестра");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/maintenance/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentId: form.equipmentId,
          scheduledDate: form.scheduledDate,
          maintenanceType: form.maintenanceType,
          status: "PLANNED",
          laborHours: form.laborHours ? Number(form.laborHours) : undefined,
          totalCost: form.totalCost ? Number(form.totalCost) : undefined,
          resultNotes: form.resultNotes || undefined
        })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        notifyError(data.error || "Не удалось создать операцию");
        return;
      }
      notifySuccess("Операция ТОиР создана");
      setForm((prev) => ({ ...prev, equipmentId: "", laborHours: "", totalCost: "", resultNotes: "" }));
      setTaskPage(1);
      await loadTasks();
    } catch {
      notifyError("Сетевая ошибка при создании операции");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (taskId: string, nextStatus: Task["status"]) => {
    const performedAt = nextStatus === "COMPLETED" ? new Date().toISOString() : undefined;
    const res = await fetch(`/api/maintenance/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, performedAt })
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      notifyError(data.error || "Не удалось обновить статус операции");
      return;
    }
    notifySuccess("Статус операции обновлен");
    await loadTasks();
  };

  const applyBulkStatus = async () => {
    if (!selectedTaskIds.length) {
      notifyError("Выберите хотя бы одну операцию");
      return;
    }

    setBulkUpdating(true);
    try {
      const res = await fetch("/api/maintenance/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedTaskIds, status: bulkStatus })
      });
      const data = (await res.json()) as { error?: string; updated?: number };
      if (!res.ok) {
        notifyError(data.error || "Не удалось выполнить массовое обновление");
        return;
      }
      notifySuccess("Массовое действие выполнено", `Обновлено операций: ${data.updated || 0}`);
      await loadTasks();
    } catch {
      notifyError("Сетевая ошибка массового обновления");
    } finally {
      setBulkUpdating(false);
    }
  };

  const applyBulkReschedule = async () => {
    if (!selectedTaskIds.length) {
      notifyError("Выберите хотя бы одну операцию");
      return;
    }
    if (!bulkDate) {
      notifyError("Укажите новую дату");
      return;
    }

    setBulkUpdating(true);
    try {
      const res = await fetch("/api/maintenance/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedTaskIds, scheduledDate: bulkDate })
      });
      const data = (await res.json()) as { error?: string; updated?: number };
      if (!res.ok) {
        notifyError(data.error || "Не удалось перенести даты операций");
        return;
      }
      notifySuccess("Массовый перенос выполнен", `Обновлено операций: ${data.updated || 0}`);
      await loadTasks();
    } catch {
      notifyError("Сетевая ошибка массового переноса");
    } finally {
      setBulkUpdating(false);
    }
  };

  const toggleTask = (id: string, checked: boolean) => {
    setSelectedTaskIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((item) => item !== id);
    });
  };

  const toggleAllOnPage = (checked: boolean) => {
    if (!checked) {
      setSelectedTaskIds((prev) => prev.filter((id) => !filteredTasks.some((row) => row.id === id)));
      return;
    }
    setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...filteredTasks.map((row) => row.id)])));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: "Операции ТОиР" }]} />
          <h1 className="mt-4 text-3xl font-bold">Исполнение ППР и ремонтов</h1>
          <p className="mt-1 text-muted-foreground">Массовые операции, SLA-контроль и приоритизация задач в едином списке.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void syncEquipment()} disabled={syncingEquipment}>
          {syncingEquipment ? "Синхронизация..." : "Синхронизировать оборудование"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Операций на странице" value={tasks.length} hint={`Всего по фильтру: ${tasksTotal}`} />
        <KpiCard label="PLANNED" value={taskStats.planned} tone="warning" hint="Ожидают старта" />
        <KpiCard label="IN_PROGRESS" value={taskStats.inProgress} hint="Выполняются" />
        <KpiCard label="OVERDUE" value={taskStats.overdue} tone="critical" hint="SLA нарушен" />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Новая операция</h2>
        <form className="grid grid-cols-1 gap-3 md:grid-cols-3" onSubmit={(e) => void onCreate(e)}>
          <div className="relative md:col-span-2">
            <Input
              placeholder="Поиск оборудования (код/название/ID)"
              value={equipmentQuery}
              onFocus={() => setShowEquipmentDropdown(true)}
              onChange={(e) => {
                setEquipmentQuery(e.target.value);
                setShowEquipmentDropdown(true);
                if (form.equipmentId) {
                  setForm((prev) => ({ ...prev, equipmentId: "" }));
                }
              }}
            />
            {showEquipmentDropdown ? (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-white shadow-lg">
                {equipmentLoading ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Поиск...</div>
                ) : equipmentItems.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Ничего не найдено</div>
                ) : (
                  equipmentItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, equipmentId: item.id }));
                        setEquipmentQuery((item.equipmentCode ? `${item.equipmentCode} | ` : "") + item.name);
                        setShowEquipmentDropdown(false);
                      }}
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{item.equipmentCode || item.id}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <Input type="date" value={form.scheduledDate} onChange={(e) => setForm((prev) => ({ ...prev, scheduledDate: e.target.value }))} />

          <div className="md:col-span-3 rounded-md border border-border px-3 py-2 text-sm">
            {form.equipmentId ? (
              <span className="text-muted-foreground">
                Выбрано оборудование: <span className="font-medium text-foreground">{form.equipmentId}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Введите поиск и выберите оборудование из выпадающего списка.</span>
            )}
          </div>

          <AppSelect value={form.maintenanceType} onChange={(e) => setForm((prev) => ({ ...prev, maintenanceType: e.target.value }))}>
            <option value="PREVENTIVE">PREVENTIVE</option>
            <option value="SEASONAL">SEASONAL</option>
            <option value="CAPITAL">CAPITAL</option>
            <option value="DIAGNOSTIC">DIAGNOSTIC</option>
          </AppSelect>
          <Input type="number" min={0} step="0.25" placeholder="Трудозатраты (часы)" value={form.laborHours} onChange={(e) => setForm((prev) => ({ ...prev, laborHours: e.target.value }))} />
          <Input type="number" min={0} step="0.01" placeholder="Стоимость" value={form.totalCost} onChange={(e) => setForm((prev) => ({ ...prev, totalCost: e.target.value }))} />
          <Input className="md:col-span-2" placeholder="Комментарий/результат" value={form.resultNotes} onChange={(e) => setForm((prev) => ({ ...prev, resultNotes: e.target.value }))} />
          <Button type="submit" disabled={submitting || !form.equipmentId.trim()}>
            {submitting ? "Создание..." : "Создать операцию"}
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          <Input
            data-global-search="true"
            placeholder="Поиск по equipment_id..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setTaskPage(1);
            }}
          />
          <AppSelect value={status} onChange={(e) => { setStatus(e.target.value); setTaskPage(1); }}>
            <option value="all">Все статусы</option>
            <option value="PLANNED">PLANNED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="OVERDUE">OVERDUE</option>
            <option value="CANCELED">CANCELED</option>
          </AppSelect>
          <AppSelect value={maintenanceType} onChange={(e) => { setMaintenanceType(e.target.value); setTaskPage(1); }}>
            <option value="all">Все типы</option>
            <option value="PREVENTIVE">PREVENTIVE</option>
            <option value="SEASONAL">SEASONAL</option>
            <option value="CAPITAL">CAPITAL</option>
            <option value="DIAGNOSTIC">DIAGNOSTIC</option>
          </AppSelect>
          <AppSelect value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="all">Priority: все</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </AppSelect>
          <AppSelect value={slaPreset} onChange={(e) => setSlaPreset(e.target.value)}>
            <option value="all">SLA: все</option>
            <option value="breached">Only breached</option>
            <option value="due_today">Due today</option>
          </AppSelect>
          <Button variant="outline" onClick={() => void loadTasks()}>Обновить</Button>
          <div className="flex items-center justify-end text-sm text-muted-foreground">
            Всего: {tasksTotal}
          </div>
        </div>
      </Card>

      {selectedTaskIds.length > 0 ? (
        <Card className="sticky bottom-4 z-30 border-primary/30 p-4 shadow-lg">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">Выбрано операций: {selectedTaskIds.length}</p>
            <AppSelect value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELED">CANCELED</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="PLANNED">PLANNED</option>
            </AppSelect>
            <Button onClick={() => void applyBulkStatus()} disabled={bulkUpdating}>
              {bulkUpdating ? "Применение..." : "Применить массово"}
            </Button>
            <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} className="w-auto min-w-[160px]" />
            <Button variant="outline" onClick={() => void applyBulkReschedule()} disabled={bulkUpdating}>
              Перенести дату
            </Button>
            <Button variant="outline" onClick={() => setSelectedTaskIds([])}>
              Сбросить выбор
            </Button>
          </div>
        </Card>
      ) : null}

      {loading ? <LoadingState text="Загрузка операций..." /> : null}
      {!loading && error ? <ErrorState text={error} onRetry={() => void loadTasks()} /> : null}
      {!loading && !error && filteredTasks.length === 0 ? <EmptyState text="Операции не найдены." /> : null}

      {!loading && !error && filteredTasks.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">
                    <input type="checkbox" checked={allOnPageSelected} onChange={(e) => toggleAllOnPage(e.target.checked)} />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Оборудование</th>
                  <th className="px-4 py-3 text-left font-semibold">Тип</th>
                  <th className="px-4 py-3 text-left font-semibold">Дата</th>
                  <th className="px-4 py-3 text-left font-semibold">Приоритет</th>
                  <th className="px-4 py-3 text-left font-semibold">SLA</th>
                  <th className="px-4 py-3 text-left font-semibold">Статус</th>
                  <th className="px-4 py-3 text-left font-semibold">Комментарий</th>
                  <th className="px-4 py-3 text-left font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDrawerTaskId(task.id)}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes(task.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => toggleTask(task.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono">{task.equipmentId}</td>
                    <td className="px-4 py-3">{task.maintenanceType}</td>
                    <td className="px-4 py-3">{fmtDate(task.scheduledDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={task.priority} group="severity" /></td>
                    <td className={`px-4 py-3 font-medium ${task.slaClass}`}>{task.slaLabel}</td>
                    <td className="px-4 py-3"><StatusBadge status={task.status} group="task" /></td>
                    <td className="px-4 py-3">{task.resultNotes || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); void updateStatus(task.id, "IN_PROGRESS"); }}>В работу</Button>
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); void updateStatus(task.id, "COMPLETED"); }}>Завершить</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={taskPage}
            pageCount={taskPageCount}
            total={tasksTotal}
            pageSize={taskPageSize}
            onPageChange={setTaskPage}
            onPageSizeChange={(next) => {
              setTaskPageSize(next);
              setTaskPage(1);
            }}
            label="Операции"
          />
        </Card>
      ) : null}
      <DetailsDrawer open={Boolean(drawerTask)} title="Детали операции" onClose={() => setDrawerTaskId(null)}>
        {drawerTask ? (
          <>
            <p><span className="text-muted-foreground">ID:</span> {drawerTask.id}</p>
            <p><span className="text-muted-foreground">Оборудование:</span> {drawerTask.equipmentId}</p>
            <p><span className="text-muted-foreground">Тип:</span> {drawerTask.maintenanceType}</p>
            <p><span className="text-muted-foreground">Статус:</span> {drawerTask.status}</p>
            <p><span className="text-muted-foreground">Дата:</span> {fmtDate(drawerTask.scheduledDate)}</p>
            <p><span className="text-muted-foreground">SLA:</span> {drawerTask.slaLabel}</p>
            <p><span className="text-muted-foreground">Комментарий:</span> {drawerTask.resultNotes || "-"}</p>
          </>
        ) : null}
      </DetailsDrawer>
    </div>
  );
}
