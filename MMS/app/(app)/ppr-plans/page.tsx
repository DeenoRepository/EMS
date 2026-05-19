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
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { notifyError, notifySuccess } from "@/lib/client/notify";
import { clearDraft, useDraftState } from "@/lib/client/use-draft";

type Plan = {
  id: string;
  equipmentId: string;
  equipmentCode?: string | null;
  equipmentName?: string | null;
  maintenanceType: "PREVENTIVE" | "SEASONAL" | "CAPITAL" | "DIAGNOSTIC";
  intervalDays: number;
  horizonMonths: number;
  lastServiceDate: string;
  nextServiceDate: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
};

type EquipmentRef = {
  id: string;
  equipmentCode?: string | null;
  name: string;
  status?: string | null;
  lifecycleStage?: string | null;
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU");
}

export default function PprPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansTotal, setPlansTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [planPage, setPlanPage] = useState(1);
  const [planPageSize, setPlanPageSize] = useState(20);
  const [creating, setCreating] = useState(false);

  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [equipmentItems, setEquipmentItems] = useState<EquipmentRef[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false);
  const [syncingEquipment, setSyncingEquipment] = useState(false);
  const [generatingRegistry, setGeneratingRegistry] = useState(false);

  const [form, setForm] = useState({
    equipmentId: "",
    equipmentCode: "",
    equipmentName: "",
    maintenanceType: "PREVENTIVE",
    intervalDays: 90,
    horizonMonths: 12,
    lastServiceDate: new Date().toISOString().slice(0, 10),
    comments: ""
  });
  useDraftState("mms:draft:ppr-plan", form, setForm);

  const planPageCount = useMemo(() => Math.max(1, Math.ceil(plansTotal / planPageSize)), [plansTotal]);

  const planStats = useMemo(() => {
    const active = plans.filter((item) => item.status === "ACTIVE").length;
    const paused = plans.filter((item) => item.status === "PAUSED").length;
    const archived = plans.filter((item) => item.status === "ARCHIVED").length;
    return { active, paused, archived };
  }, [plans]);

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, page: String(planPage), pageSize: String(planPageSize) });
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/maintenance/plans?${params.toString()}`);
      if (!res.ok) {
        setError("Не удалось загрузить планы ППР");
        return;
      }
      const data = (await res.json()) as Paged<Plan>;
      setPlans(data.items || []);
      setPlansTotal(data.total || 0);
    } catch {
      setError("Сетевая ошибка при загрузке планов ППР");
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
    void loadPlans();
  }, [q, status, planPage, planPageSize]);

  useEffect(() => {
    void loadEquipment();
  }, [equipmentQuery]);

  const onEquipmentSelect = (equipmentId: string) => {
    const selected = equipmentItems.find((item) => item.id === equipmentId);
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      equipmentId,
      equipmentCode: selected?.equipmentCode || "",
      equipmentName: selected?.name || ""
    }));
    setEquipmentQuery((selected.equipmentCode ? `${selected.equipmentCode} | ` : "") + selected.name);
    setShowEquipmentDropdown(false);
  };

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

  const generateFromRegistry = async () => {
    setGeneratingRegistry(true);
    try {
      const res = await fetch("/api/maintenance/plans/generate-from-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intervalDays: 90,
          horizonMonths: 12,
          maintenanceType: "PREVENTIVE",
          statusFilter: ["ACTIVE"],
          lifecycleFilter: ["IN_OPERATION", "MAINTENANCE"]
        })
      });
      const data = (await res.json()) as { error?: string; createdPlans?: number; createdTasks?: number };
      if (!res.ok) {
        notifyError(data.error || "Не удалось сформировать ППР по реестру");
        return;
      }
      notifySuccess("ППР сформированы", `Планов: ${data.createdPlans || 0}, задач: ${data.createdTasks || 0}`);
      setPlanPage(1);
      await loadPlans();
    } catch {
      notifyError("Ошибка генерации ППР по реестру");
    } finally {
      setGeneratingRegistry(false);
    }
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.equipmentId.trim()) {
      notifyError("Выберите оборудование из синхронизированного реестра");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/maintenance/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          intervalDays: Number(form.intervalDays),
          horizonMonths: Number(form.horizonMonths)
        })
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        notifyError(data.error || "Не удалось создать план");
        return;
      }

      notifySuccess("План ППР создан");
      setForm((prev) => ({ ...prev, equipmentId: "", equipmentCode: "", equipmentName: "", comments: "" }));
      clearDraft("mms:draft:ppr-plan");
      setPlanPage(1);
      await loadPlans();
    } catch {
      notifyError("Сетевая ошибка при создании плана");
    } finally {
      setCreating(false);
    }
  };

  const generateTasks = async (id: string) => {
    const res = await fetch(`/api/maintenance/plans/${id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replaceFutureTasks: false, limit: 24 })
    });
    const data = (await res.json()) as { created?: number; error?: string };
    if (!res.ok) {
      notifyError(data.error || "Не удалось сгенерировать операции");
      return;
    }
    notifySuccess("Операции ППР сформированы", `Создано задач: ${data.created || 0}`);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: "Планы ППР" }]} />
          <h1 className="mt-4 text-3xl font-bold">Планирование ППР</h1>
          <p className="mt-1 text-muted-foreground">Оборудование синхронизируется из EPS, затем формируются индивидуальные планы и задачи.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void syncEquipment()} disabled={syncingEquipment}>
            {syncingEquipment ? "Синхронизация..." : "Синхронизировать из EPS"}
          </Button>
          <Button type="button" onClick={() => void generateFromRegistry()} disabled={generatingRegistry}>
            {generatingRegistry ? "Формирование..." : "Сформировать ППР по реестру"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Планы на странице" value={plans.length} hint={`Всего по фильтру: ${plansTotal}`} />
        <KpiCard label="ACTIVE" value={planStats.active} tone="positive" hint="Активные планы" />
        <KpiCard label="PAUSED" value={planStats.paused} tone="warning" hint="Приостановленные планы" />
        <KpiCard label="ARCHIVED" value={planStats.archived} hint="Архивные планы" />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Новый индивидуальный план</h2>
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
                  setForm((prev) => ({ ...prev, equipmentId: "", equipmentCode: "", equipmentName: "" }));
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
                      onClick={() => onEquipmentSelect(item.id)}
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{item.equipmentCode || item.id}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <div className="rounded-md border border-border px-3 py-2 text-sm">
            {form.equipmentId ? (
              <span className="text-muted-foreground">
                Выбрано: <span className="font-medium text-foreground">{form.equipmentName || "Без названия"}</span>
                {" · "}
                {form.equipmentCode || form.equipmentId}
              </span>
            ) : (
              <span className="text-muted-foreground">Сначала введите поиск, затем выберите оборудование из списка.</span>
            )}
          </div>

          <AppSelect value={form.maintenanceType} onChange={(e) => setForm((prev) => ({ ...prev, maintenanceType: e.target.value }))}>
            <option value="PREVENTIVE">PREVENTIVE</option>
            <option value="SEASONAL">SEASONAL</option>
            <option value="CAPITAL">CAPITAL</option>
            <option value="DIAGNOSTIC">DIAGNOSTIC</option>
          </AppSelect>
          <Input type="number" min={1} value={form.intervalDays} onChange={(e) => setForm((prev) => ({ ...prev, intervalDays: Number(e.target.value) }))} placeholder="Интервал в днях" />
          <Input type="number" min={1} value={form.horizonMonths} onChange={(e) => setForm((prev) => ({ ...prev, horizonMonths: Number(e.target.value) }))} placeholder="Горизонт в месяцах" />
          <Input type="date" value={form.lastServiceDate} onChange={(e) => setForm((prev) => ({ ...prev, lastServiceDate: e.target.value }))} />
          <Input className="md:col-span-2" placeholder="Комментарий (опционально)" value={form.comments} onChange={(e) => setForm((prev) => ({ ...prev, comments: e.target.value }))} />
          <Button type="submit" disabled={creating || !form.equipmentId.trim()}>
            {creating ? "Создание..." : "Создать план ППР"}
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            data-global-search="true"
            placeholder="Поиск по equipment_id/коду/наименованию..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPlanPage(1);
            }}
          />
          <AppSelect value={status} onChange={(e) => { setStatus(e.target.value); setPlanPage(1); }}>
            <option value="all">Все статусы</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAUSED">PAUSED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </AppSelect>
          <Button variant="outline" onClick={() => void loadPlans()}>Обновить</Button>
          <div className="flex items-center justify-end text-sm text-muted-foreground">Всего: {plansTotal}</div>
        </div>
      </Card>

      {loading ? <LoadingState text="Загрузка планов ППР..." /> : null}
      {!loading && error ? <ErrorState text={error} onRetry={() => void loadPlans()} /> : null}
      {!loading && !error && plans.length === 0 ? <EmptyState text="Планы ППР не найдены." /> : null}

      {!loading && !error && plans.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Оборудование</th>
                  <th className="px-4 py-3 text-left font-semibold">Тип</th>
                  <th className="px-4 py-3 text-left font-semibold">Интервал</th>
                  <th className="px-4 py-3 text-left font-semibold">Следующее ТО</th>
                  <th className="px-4 py-3 text-left font-semibold">Статус</th>
                  <th className="px-4 py-3 text-left font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{plan.equipmentName || "Без названия"}</p>
                      <p className="text-xs text-muted-foreground">{plan.equipmentCode || plan.equipmentId}</p>
                    </td>
                    <td className="px-4 py-3">{plan.maintenanceType}</td>
                    <td className="px-4 py-3">{plan.intervalDays} дней</td>
                    <td className="px-4 py-3">{fmtDate(plan.nextServiceDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={plan.status} group="plan" /></td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" onClick={() => void generateTasks(plan.id)}>
                        Сгенерировать операции
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={planPage}
            pageCount={planPageCount}
            total={plansTotal}
            pageSize={planPageSize}
            onPageChange={setPlanPage}
            onPageSizeChange={(next) => {
              setPlanPageSize(next);
              setPlanPage(1);
            }}
            label="Планы ППР"
          />
        </Card>
      ) : null}
    </div>
  );
}
