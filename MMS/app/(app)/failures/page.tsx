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

type Failure = {
  id: string;
  equipmentId: string;
  equipmentCode?: string | null;
  equipmentName?: string | null;
  occurredAt: string;
  resolvedAt?: string | null;
  downtimeMinutes: number;
  failureNode?: string | null;
  symptom: string;
  rootCauseCategory?: string | null;
  rootCauseDetail?: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  rcaStatus: "OPEN" | "IN_PROGRESS" | "CLOSED";
  owner?: string | null;
  dueDate?: string | null;
};

type EquipmentRef = {
  id: string;
  equipmentCode?: string | null;
  name: string;
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

type FailureSummary = {
  total: number;
  openRca: number;
  inProgressRca: number;
  critical: number;
  totalDowntime: number;
  avgDowntime: number;
};

type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

type FailureWithFlags = Failure & {
  priority: Priority;
  priorityRank: number;
  slaLabel: string;
  slaClass: string;
  overdueDays: number;
};

function fmtDate(value?: string | null) {
  if (!value) return "-";
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

function getFailureFlags(item: Failure): FailureWithFlags {
  if (item.rcaStatus === "CLOSED") {
    const basePriority: Priority = item.severity === "CRITICAL" ? "MEDIUM" : "LOW";
    return {
      ...item,
      priority: basePriority,
      priorityRank: basePriority === "MEDIUM" ? 3 : 4,
      slaLabel: "RCA закрыт",
      slaClass: "text-status-success",
      overdueDays: 0
    };
  }

  if (!item.dueDate) {
    const p: Priority = item.severity === "CRITICAL" ? "CRITICAL" : item.severity === "HIGH" ? "HIGH" : "MEDIUM";
    return {
      ...item,
      priority: p,
      priorityRank: p === "CRITICAL" ? 1 : p === "HIGH" ? 2 : 3,
      slaLabel: "SLA не задан",
      slaClass: "text-muted-foreground",
      overdueDays: 0
    };
  }

  const days = daysTo(item.dueDate);
  const overdueDays = days < 0 ? Math.abs(days) : 0;

  if (days < 0) {
    return {
      ...item,
      priority: "CRITICAL",
      priorityRank: 1,
      slaLabel: `SLA нарушен (${overdueDays} дн.)`,
      slaClass: "text-status-error",
      overdueDays
    };
  }

  if (days <= 1) {
    return {
      ...item,
      priority: item.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
      priorityRank: item.severity === "CRITICAL" ? 1 : 2,
      slaLabel: days === 0 ? "Срок RCA сегодня" : "Срок RCA завтра",
      slaClass: "text-status-warning",
      overdueDays
    };
  }

  const mediumOrHigh: Priority = item.severity === "CRITICAL" || item.severity === "HIGH" ? "HIGH" : "MEDIUM";
  return {
    ...item,
    priority: mediumOrHigh,
    priorityRank: mediumOrHigh === "HIGH" ? 2 : 3,
    slaLabel: `До срока RCA ${days} дн.`,
    slaClass: "text-status-info",
    overdueDays
  };
}

export default function FailuresPage() {
  const [items, setItems] = useState<Failure[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<FailureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [rcaFilter, setRcaFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [equipmentItems, setEquipmentItems] = useState<EquipmentRef[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [equipmentPage, setEquipmentPage] = useState(1);
  const [equipmentTotal, setEquipmentTotal] = useState(0);
  const [equipmentPageSize, setEquipmentPageSize] = useState(20);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRcaStatus, setBulkRcaStatus] = useState("IN_PROGRESS");
  const [bulkSeverity, setBulkSeverity] = useState("MEDIUM");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [slaPreset, setSlaPreset] = useState("all");
  const [drawerFailureId, setDrawerFailureId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    equipmentId: "",
    occurredAt: new Date().toISOString().slice(0, 10),
    symptom: "",
    failureNode: "",
    rootCauseCategory: "",
    rootCauseDetail: "",
    severity: "MEDIUM",
    rcaStatus: "OPEN",
    downtimeMinutes: "0",
    owner: "",
    dueDate: "",
    correctiveAction: "",
    preventiveAction: ""
  });

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);
  const equipmentPageCount = useMemo(() => Math.max(1, Math.ceil(equipmentTotal / equipmentPageSize)), [equipmentTotal]);

  const prioritizedItems = useMemo(() => {
    return items
      .map(getFailureFlags)
      .sort((a, b) => {
        if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
        if (a.overdueDays !== b.overdueDays) return b.overdueDays - a.overdueDays;
        return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      });
  }, [items]);

  const filteredItems = useMemo(() => {
    return prioritizedItems.filter((item) => {
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      if (slaPreset === "breached" && !(item.rcaStatus !== "CLOSED" && item.overdueDays > 0)) return false;
      if (slaPreset === "due_today" && !(item.rcaStatus !== "CLOSED" && item.dueDate && daysTo(item.dueDate) === 0)) return false;
      return true;
    });
  }, [prioritizedItems, priorityFilter, slaPreset]);

  const allOnPageSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id));
  const drawerItem = filteredItems.find((item) => item.id === drawerFailureId) || null;

  const loadFailures = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) });
      if (severityFilter !== "all") params.set("severity", severityFilter);
      if (rcaFilter !== "all") params.set("rcaStatus", rcaFilter);

      const res = await fetch(`/api/failures?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Не удалось загрузить журнал отказов");
        return;
      }
      const data = (await res.json()) as Paged<Failure>;
      setItems(data.items || []);
      setTotal(data.total || 0);
      setSelectedIds([]);
    } catch {
      setError("Сетевая ошибка при загрузке журнала отказов");
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await fetch("/api/analytics/failures/summary", { cache: "no-store" });
      if (!res.ok) {
        setSummary(null);
        return;
      }
      setSummary((await res.json()) as FailureSummary);
    } catch {
      setSummary(null);
    }
  };

  const loadEquipment = async () => {
    setEquipmentLoading(true);
    try {
      const params = new URLSearchParams({ page: String(equipmentPage), pageSize: String(equipmentPageSize) });
      if (equipmentQuery.trim()) params.set("q", equipmentQuery.trim());
      const res = await fetch(`/api/integrations/eps/synced-equipment?${params.toString()}`);
      if (!res.ok) {
        setEquipmentItems([]);
        setEquipmentTotal(0);
        return;
      }
      const data = (await res.json()) as Paged<EquipmentRef>;
      setEquipmentItems(data.items || []);
      setEquipmentTotal(data.total || 0);
    } catch {
      setEquipmentItems([]);
      setEquipmentTotal(0);
    } finally {
      setEquipmentLoading(false);
    }
  };

  useEffect(() => {
    void loadFailures();
  }, [q, severityFilter, rcaFilter, page, pageSize]);

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    void loadEquipment();
  }, [equipmentQuery, equipmentPage, equipmentPageSize]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.equipmentId.trim()) {
      notifyError("Выберите оборудование из синхронизированного реестра");
      return;
    }
    if (form.symptom.trim().length < 2) {
      notifyError("Опишите симптом отказа (минимум 2 символа)");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/failures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentId: form.equipmentId,
          occurredAt: form.occurredAt,
          symptom: form.symptom,
          failureNode: form.failureNode || undefined,
          rootCauseCategory: form.rootCauseCategory || undefined,
          rootCauseDetail: form.rootCauseDetail || undefined,
          severity: form.severity,
          rcaStatus: form.rcaStatus,
          downtimeMinutes: Number(form.downtimeMinutes || "0"),
          owner: form.owner || undefined,
          dueDate: form.dueDate || undefined,
          correctiveAction: form.correctiveAction || undefined,
          preventiveAction: form.preventiveAction || undefined
        })
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        notifyError(data.error || "Не удалось создать запись об отказе");
        return;
      }

      notifySuccess("Отказ зарегистрирован");
      setForm((prev) => ({ ...prev, symptom: "", failureNode: "", rootCauseCategory: "", rootCauseDetail: "", owner: "", correctiveAction: "", preventiveAction: "" }));
      setPage(1);
      await Promise.all([loadFailures(), loadSummary()]);
    } catch {
      notifyError("Сетевая ошибка при создании отказа");
    } finally {
      setSubmitting(false);
    }
  };

  const applyBulk = async () => {
    if (!selectedIds.length) {
      notifyError("Выберите хотя бы одну запись");
      return;
    }

    setBulkUpdating(true);
    try {
      const res = await fetch("/api/failures/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          rcaStatus: bulkRcaStatus,
          severity: bulkSeverity
        })
      });

      const data = (await res.json()) as { error?: string; updated?: number };
      if (!res.ok) {
        notifyError(data.error || "Не удалось выполнить массовое обновление");
        return;
      }

      notifySuccess("Массовое действие выполнено", `Обновлено записей: ${data.updated || 0}`);
      await Promise.all([loadFailures(), loadSummary()]);
    } catch {
      notifyError("Сетевая ошибка массового обновления");
    } finally {
      setBulkUpdating(false);
    }
  };

  const toggleItem = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((item) => item !== id);
    });
  };

  const toggleAllOnPage = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) => prev.filter((id) => !filteredItems.some((row) => row.id === id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredItems.map((row) => row.id)])));
  };

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Отказы и RCA" }]} />
        <h1 className="mt-4 text-3xl font-bold">Журнал отказов и RCA</h1>
        <p className="mt-1 text-muted-foreground">Массовые действия, SLA-контроль RCA и приоритизация по риску.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Отказов" value={summary?.total || 0} hint="Всего зарегистрировано" />
        <KpiCard label="RCA OPEN" value={summary?.openRca || 0} tone="critical" hint="Требует расследования" />
        <KpiCard label="RCA IN_PROGRESS" value={summary?.inProgressRca || 0} tone="warning" hint="В работе" />
        <KpiCard label="CRITICAL" value={summary?.critical || 0} tone="critical" hint="Критичные отказы" />
        <KpiCard label="Средний простой" value={summary?.avgDowntime || 0} hint="Минут на инцидент" />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Регистрация отказа</h2>
        <form className="grid grid-cols-1 gap-3 md:grid-cols-3" onSubmit={(e) => void onCreate(e)}>
          <Input
            placeholder="Поиск оборудования в реестре ТОиР"
            value={equipmentQuery}
            onChange={(e) => {
              setEquipmentQuery(e.target.value);
              setEquipmentPage(1);
            }}
          />
          <AppSelect value={form.equipmentId} onChange={(e) => setForm((prev) => ({ ...prev, equipmentId: e.target.value }))}>
            <option value="">{equipmentLoading ? "Загрузка реестра..." : "Выберите оборудование"}</option>
            {equipmentItems.map((item) => (
              <option key={item.id} value={item.id}>
                {(item.equipmentCode ? `${item.equipmentCode} | ` : "") + item.name}
              </option>
            ))}
          </AppSelect>
          <Input type="date" value={form.occurredAt} onChange={(e) => setForm((prev) => ({ ...prev, occurredAt: e.target.value }))} />

          <div className="md:col-span-3 rounded-md border border-border">
            <PaginationControls
              page={equipmentPage}
              pageCount={equipmentPageCount}
              total={equipmentTotal}
              pageSize={equipmentPageSize}
              onPageChange={setEquipmentPage}
              onPageSizeChange={(next) => {
                setEquipmentPageSize(next);
                setEquipmentPage(1);
              }}
              label="Реестр ТОиР"
              disabled={equipmentLoading}
            />
          </div>

          <Input placeholder="Узел/агрегат" value={form.failureNode} onChange={(e) => setForm((prev) => ({ ...prev, failureNode: e.target.value }))} />
          <Input className="md:col-span-2" placeholder="Симптом отказа" value={form.symptom} onChange={(e) => setForm((prev) => ({ ...prev, symptom: e.target.value }))} />

          <Input placeholder="Категория причины" value={form.rootCauseCategory} onChange={(e) => setForm((prev) => ({ ...prev, rootCauseCategory: e.target.value }))} />
          <Input className="md:col-span-2" placeholder="Детализация причины" value={form.rootCauseDetail} onChange={(e) => setForm((prev) => ({ ...prev, rootCauseDetail: e.target.value }))} />

          <AppSelect value={form.severity} onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value }))}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </AppSelect>
          <AppSelect value={form.rcaStatus} onChange={(e) => setForm((prev) => ({ ...prev, rcaStatus: e.target.value }))}>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="CLOSED">CLOSED</option>
          </AppSelect>
          <Input type="number" min={0} placeholder="Простой, мин" value={form.downtimeMinutes} onChange={(e) => setForm((prev) => ({ ...prev, downtimeMinutes: e.target.value }))} />

          <Input placeholder="Ответственный" value={form.owner} onChange={(e) => setForm((prev) => ({ ...prev, owner: e.target.value }))} />
          <Input type="date" placeholder="Срок RCA" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
          <div />

          <Input className="md:col-span-3" placeholder="Корректирующее действие" value={form.correctiveAction} onChange={(e) => setForm((prev) => ({ ...prev, correctiveAction: e.target.value }))} />
          <Input className="md:col-span-3" placeholder="Превентивное действие" value={form.preventiveAction} onChange={(e) => setForm((prev) => ({ ...prev, preventiveAction: e.target.value }))} />

          <Button type="submit" disabled={submitting || !form.equipmentId.trim()}>
            {submitting ? "Сохранение..." : "Зарегистрировать отказ"}
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          <Input
            placeholder="Поиск по оборудованию/симптому/причине..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <AppSelect value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}>
            <option value="all">Вся критичность</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </AppSelect>
          <AppSelect value={rcaFilter} onChange={(e) => { setRcaFilter(e.target.value); setPage(1); }}>
            <option value="all">Все статусы RCA</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="CLOSED">CLOSED</option>
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
          <Button variant="outline" onClick={() => void loadFailures()}>Обновить</Button>
          <div className="flex items-center justify-end text-sm text-muted-foreground">Всего: {total}</div>
        </div>
      </Card>

      {selectedIds.length > 0 ? (
        <Card className="sticky bottom-4 z-30 border-primary/30 p-4 shadow-lg">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">Выбрано отказов: {selectedIds.length}</p>
            <AppSelect value={bulkRcaStatus} onChange={(e) => setBulkRcaStatus(e.target.value)}>
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="CLOSED">CLOSED</option>
            </AppSelect>
            <AppSelect value={bulkSeverity} onChange={(e) => setBulkSeverity(e.target.value)}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </AppSelect>
            <Button onClick={() => void applyBulk()} disabled={bulkUpdating}>
              {bulkUpdating ? "Применение..." : "Применить массово"}
            </Button>
            <Button variant="outline" onClick={() => setSelectedIds([])}>Сбросить выбор</Button>
          </div>
        </Card>
      ) : null}

      {loading ? <LoadingState text="Загрузка отказов..." /> : null}
      {!loading && error ? <ErrorState text={error} onRetry={() => void loadFailures()} /> : null}
      {!loading && !error && filteredItems.length === 0 ? <EmptyState text="Записи об отказах не найдены." /> : null}

      {!loading && !error && filteredItems.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">
                    <input type="checkbox" checked={allOnPageSelected} onChange={(e) => toggleAllOnPage(e.target.checked)} />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Оборудование</th>
                  <th className="px-4 py-3 text-left font-semibold">Дата</th>
                  <th className="px-4 py-3 text-left font-semibold">Симптом</th>
                  <th className="px-4 py-3 text-left font-semibold">Причина</th>
                  <th className="px-4 py-3 text-left font-semibold">Priority</th>
                  <th className="px-4 py-3 text-left font-semibold">SLA RCA</th>
                  <th className="px-4 py-3 text-left font-semibold">Severity</th>
                  <th className="px-4 py-3 text-left font-semibold">RCA</th>
                  <th className="px-4 py-3 text-left font-semibold">Простой</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDrawerFailureId(item.id)}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => toggleItem(item.id, e.target.checked)} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.equipmentName || item.equipmentId}</p>
                      <p className="text-xs text-muted-foreground">{item.equipmentCode || item.equipmentId}</p>
                    </td>
                    <td className="px-4 py-3">{fmtDate(item.occurredAt)}</td>
                    <td className="px-4 py-3">{item.symptom}</td>
                    <td className="px-4 py-3">{item.rootCauseCategory || "-"}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.priority} group="severity" /></td>
                    <td className={`px-4 py-3 font-medium ${item.slaClass}`}>{item.slaLabel}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.severity} group="severity" /></td>
                    <td className="px-4 py-3"><StatusBadge status={item.rcaStatus} group="rca" /></td>
                    <td className="px-4 py-3">{item.downtimeMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
            label="Отказы"
          />
        </Card>
      ) : null}
      <DetailsDrawer open={Boolean(drawerItem)} title="Детали отказа" onClose={() => setDrawerFailureId(null)}>
        {drawerItem ? (
          <>
            <p><span className="text-muted-foreground">ID:</span> {drawerItem.id}</p>
            <p><span className="text-muted-foreground">Оборудование:</span> {drawerItem.equipmentName || drawerItem.equipmentId}</p>
            <p><span className="text-muted-foreground">Симптом:</span> {drawerItem.symptom}</p>
            <p><span className="text-muted-foreground">Причина:</span> {drawerItem.rootCauseCategory || "-"}</p>
            <p><span className="text-muted-foreground">RCA:</span> {drawerItem.rcaStatus}</p>
            <p><span className="text-muted-foreground">SLA:</span> {drawerItem.slaLabel}</p>
            <p><span className="text-muted-foreground">Ответственный:</span> {drawerItem.owner || "-"}</p>
          </>
        ) : null}
      </DetailsDrawer>
    </div>
  );
}
