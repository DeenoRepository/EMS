"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { notifyError, notifySuccess } from "@/lib/client/notify";

type ScheduleOrder = {
  id: string;
  equipmentId: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "NEW" | "APPROVED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELED";
  assignedTo?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  estimatedLaborHours?: number | null;
};

type ScheduleResponse = {
  from: string;
  to: string;
  workOrders: ScheduleOrder[];
  loadByAssignee: Array<{ assignee: string; tasks: number; critical: number; estimatedLaborHours: number }>;
};

function initialRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  to.setDate(to.getDate() + 14);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
}

export default function SchedulePage() {
  const range = initialRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [assignee, setAssignee] = useState("");
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (assignee.trim()) params.set("assignee", assignee.trim());
      const res = await fetch(`/api/maintenance/schedule?${params.toString()}`);
      if (!res.ok) {
        notifyError("Не удалось загрузить расписание");
        setData(null);
        return;
      }
      setData((await res.json()) as ScheduleResponse);
    } catch {
      notifyError("Сетевая ошибка загрузки расписания");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const quickAssign = async (id: string, currentAssignee?: string | null) => {
    const worker = prompt("Исполнитель", currentAssignee || "");
    if (!worker) return;
    const start = prompt("План старт (ISO: 2026-05-06T08:00:00Z)", new Date().toISOString());
    const end = prompt("План окончание (ISO: 2026-05-06T18:00:00Z)", new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString());
    if (!start || !end) return;

    setAssigningId(id);
    try {
      const res = await fetch("/api/maintenance/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: id,
          assignedTo: worker,
          plannedStartAt: start,
          plannedEndAt: end,
          status: "APPROVED"
        })
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        notifyError(body.error || "Не удалось назначить работу");
        return;
      }
      notifySuccess("Работа назначена");
      await load();
    } catch {
      notifyError("Сетевая ошибка назначения");
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Планирование" }]} />
        <h1 className="mt-4 text-3xl font-bold">План-график работ</h1>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input placeholder="Исполнитель (фильтр)" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
          <Button onClick={() => void load()}>{loading ? "Загрузка..." : "Обновить"}</Button>
          <AppSelect value="" onChange={() => undefined}>
            <option value="">Активные статусы: NEW/APPROVED/IN_PROGRESS/ON_HOLD</option>
          </AppSelect>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Работы в диапазоне</h2>
          <div className="space-y-3">
            {(data?.workOrders || []).map((item) => (
              <div key={item.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.equipmentId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.priority} group="severity" />
                    <StatusBadge status={item.status} group="task" />
                    <Button size="sm" variant="outline" disabled={assigningId === item.id} onClick={() => void quickAssign(item.id, item.assignedTo)}>
                      {assigningId === item.id ? "..." : "Назначить"}
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.assignedTo || "UNASSIGNED"} • {item.plannedStartAt || "-"} → {item.plannedEndAt || "-"}
                </p>
              </div>
            ))}
            {!loading && !(data?.workOrders || []).length ? <p className="text-sm text-muted-foreground">Нет работ в выбранном диапазоне.</p> : null}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-lg font-semibold">Загрузка по исполнителям</h2>
          <div className="space-y-2">
            {(data?.loadByAssignee || []).map((item) => (
              <div key={item.assignee} className="rounded-md border border-border p-2 text-sm">
                <p className="font-medium">{item.assignee}</p>
                <p className="text-muted-foreground">Задач: {item.tasks}</p>
                <p className="text-muted-foreground">Critical: {item.critical}</p>
                <p className="text-muted-foreground">Трудозатраты: {Math.round(item.estimatedLaborHours * 100) / 100} ч</p>
              </div>
            ))}
            {!loading && !(data?.loadByAssignee || []).length ? <p className="text-sm text-muted-foreground">Нет данных.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

