"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";

type Equipment = {
  id: string;
  name: string;
  type?: string | null;
  lifecycleStage?: "PLANNED" | "COMMISSIONED" | "IN_OPERATION" | "MAINTENANCE" | "RETIRED";
  department?: string | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "DECOMMISSIONED";
  serviceDueDate?: string | null;
  warrantyExpiration?: string | null;
  updatedAt: string;
};

type Approval = {
  id: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
  submittedAt: string;
  comments?: string | null;
};

type Document = { id: string; equipmentId: string; docType: string };

type Event = {
  id: string;
  title: string;
  createdAt: string;
  actor?: { displayName: string } | null;
  equipment: { id: string; name: string };
};

type DashboardSummaryResponse = {
  equipment: Equipment[];
  approvals: Approval[];
  documents: Document[];
  events: Event[];
  requiredByEquipmentType: Record<string, string[]>;
};

function isSoon(dateValue?: string | null, days = 30) {
  if (!dateValue) return false;
  const target = new Date(dateValue).getTime();
  const now = Date.now();
  const diff = target - now;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function isOverdue(dateValue?: string | null) {
  if (!dateValue) return false;
  return new Date(dateValue).getTime() < Date.now();
}

function normalizeType(type?: string | null) {
  return (type || "").trim().toUpperCase();
}

function statusLabel(status: Equipment["status"]) {
  const map: Record<Equipment["status"], string> = {
    DRAFT: "Черновик",
    ACTIVE: "В эксплуатации",
    INACTIVE: "Обслуживание",
    DECOMMISSIONED: "Списано"
  };
  return map[status];
}

function lifecycleLabel(stage?: Equipment["lifecycleStage"]) {
  if (!stage) return "Не задан";
  const map: Record<NonNullable<Equipment["lifecycleStage"]>, string> = {
    PLANNED: "Планирование",
    COMMISSIONED: "Ввод",
    IN_OPERATION: "Эксплуатация",
    MAINTENANCE: "Обслуживание",
    RETIRED: "Выведено"
  };
  return map[stage];
}

export default function DashboardPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [requiredMap, setRequiredMap] = useState<Record<string, string[]>>({ DEFAULT: ["PASSPORT", "OPERATION_MANUAL"] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const summaryRes = await fetch("/api/dashboard/summary", { cache: "no-store" });
        if (!summaryRes.ok) {
          setError("Не удалось загрузить данные панели");
          return;
        }

        const summary: DashboardSummaryResponse = await summaryRes.json();

        setEquipment(summary.equipment || []);
        setApprovals(summary.approvals || []);
        setDocuments(summary.documents || []);
        setEvents(summary.events || []);
        setRequiredMap(summary.requiredByEquipmentType || { DEFAULT: ["PASSPORT", "OPERATION_MANUAL"] });
      } catch {
        setError("Сетевая ошибка при загрузке панели");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const metrics = useMemo(() => {
    const byEquipment = new Map<string, Set<string>>();
    for (const document of documents) {
      if (!byEquipment.has(document.equipmentId)) byEquipment.set(document.equipmentId, new Set());
      byEquipment.get(document.equipmentId)!.add(document.docType);
    }

    const missingDocuments = equipment.filter((item) => {
      const present = byEquipment.get(item.id) || new Set<string>();
      const key = normalizeType(item.type);
      const required = requiredMap[key] || requiredMap.DEFAULT || ["PASSPORT", "OPERATION_MANUAL"];
      return required.some((docType) => !present.has(docType));
    }).length;

    return [
      { label: "Всего единиц оборудования", value: equipment.length },
      { label: "Единиц в эксплуатации", value: equipment.filter((item) => item.status === "ACTIVE").length },
      { label: "ТО просрочено или скоро", value: equipment.filter((item) => isOverdue(item.serviceDueDate) || isSoon(item.serviceDueDate, 14)).length },
      { label: "Гарантия истекает (30 дней)", value: equipment.filter((item) => isSoon(item.warrantyExpiration, 30)).length },
      { label: "Без обязательных документов", value: missingDocuments },
      { label: "Заявок на согласовании", value: approvals.filter((item) => item.status === "PENDING").length },
      { label: "Объектов с изменениями", value: new Set(events.map((item) => item.equipment.id)).size }
    ];
  }, [equipment, approvals, documents, events, requiredMap]);

  const analytics = useMemo(() => {
    const docsByEquipment = new Map<string, Set<string>>();
    for (const document of documents) {
      if (!docsByEquipment.has(document.equipmentId)) docsByEquipment.set(document.equipmentId, new Set());
      docsByEquipment.get(document.equipmentId)!.add(document.docType);
    }

    const missingByDocType = new Map<string, number>();
    const attention = equipment
      .map((item) => {
        const reasons: string[] = [];
        const present = docsByEquipment.get(item.id) || new Set<string>();
        const required = requiredMap[normalizeType(item.type)] || requiredMap.DEFAULT || ["PASSPORT", "OPERATION_MANUAL"];
        const missingTypes = required.filter((docType) => !present.has(docType));

        if (item.status === "DRAFT") reasons.push("черновик");
        if (item.status === "INACTIVE") reasons.push("в обслуживании");
        if (isOverdue(item.serviceDueDate)) reasons.push("просрочено ТО");
        if (isOverdue(item.warrantyExpiration)) reasons.push("гарантия истекла");
        if (missingTypes.length > 0) reasons.push(`нет документов: ${missingTypes.join(", ")}`);

        for (const docType of missingTypes) {
          missingByDocType.set(docType, (missingByDocType.get(docType) || 0) + 1);
        }

        const score = reasons.length + (isOverdue(item.serviceDueDate) ? 1 : 0) + (isOverdue(item.warrantyExpiration) ? 1 : 0);
        return { item, score, reasons };
      })
      .filter((entry) => entry.reasons.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const statusCounts = equipment.reduce<Record<Equipment["status"], number>>(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { DRAFT: 0, ACTIVE: 0, INACTIVE: 0, DECOMMISSIONED: 0 }
    );

    const lifecycleCounts = equipment.reduce<Record<string, number>>((acc, item) => {
      const key = lifecycleLabel(item.lifecycleStage);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const approvalsByStatus = approvals.reduce<Record<Approval["status"], number>>(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { DRAFT: 0, PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELED: 0 }
    );

    const overdueMaintenance = equipment
      .filter((item) => isOverdue(item.serviceDueDate))
      .sort((a, b) => new Date(a.serviceDueDate || 0).getTime() - new Date(b.serviceDueDate || 0).getTime())
      .slice(0, 4);

    const complianceRate = equipment.length
      ? Math.max(0, Math.round(((equipment.length - metrics[4].value) / equipment.length) * 100))
      : 100;

    return {
      statusCounts,
      lifecycleCounts,
      approvalsByStatus,
      overdueMaintenance,
      attention,
      missingByDocType: [...missingByDocType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      complianceRate
    };
  }, [documents, equipment, approvals, requiredMap, metrics]);

  const upcomingMaintenance = useMemo(
    () =>
      equipment
        .filter((item) => item.serviceDueDate && isSoon(item.serviceDueDate, 45))
        .sort((a, b) => new Date(a.serviceDueDate || "").getTime() - new Date(b.serviceDueDate || "").getTime())
        .slice(0, 4),
    [equipment]
  );

  const pendingApprovals = useMemo(() => approvals.filter((item) => item.status === "PENDING").slice(0, 4), [approvals]);

  if (loading) return <LoadingState text="Загрузка панели..." />;
  if (error) return <ErrorState text={error} />;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Панель управления" }]} />
        <h1 className="mt-4 text-3xl font-bold">Центр мониторинга оборудования</h1>
        <p className="mt-1 text-muted-foreground">Оперативный обзор состояния оборудования, документов и согласований.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-7">
        {metrics.map((metric) => (
          <KpiCard key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Зоны внимания</h2>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Просроченное ТО</span>
              <Badge className="border-0 bg-status-error/20 text-status-error">{analytics.overdueMaintenance.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Гарантия истекла</span>
              <Badge className="border-0 bg-status-warning/20 text-status-warning">
                {equipment.filter((item) => isOverdue(item.warrantyExpiration)).length}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Черновики карточек</span>
              <Badge className="border-0 bg-status-info/20 text-status-info">{analytics.statusCounts.DRAFT}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Без обязательных документов</span>
              <Badge className="border-0 bg-status-error/20 text-status-error">{metrics[4].value}</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Распределение оборудования</h2>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {Object.entries(analytics.statusCounts).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-muted-foreground">{statusLabel(key as Equipment["status"])}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Этапы жизненного цикла</p>
            <div className="mt-2 space-y-1 text-sm">
              {Object.entries(analytics.lifecycleCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([stage, count]) => (
                  <div key={stage} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{stage}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Покрытие документами</h2>
          </div>
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">Покрытие обязательных документов: {analytics.complianceRate}%</p>
            <div className="mt-3 h-2 rounded bg-muted">
              <div className="h-2 rounded bg-primary" style={{ width: `${analytics.complianceRate}%` }} />
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Чаще всего отсутствуют</p>
              <div className="mt-2 space-y-1 text-sm">
                {analytics.missingByDocType.length === 0 ? (
                  <p className="text-muted-foreground">Критичных пробелов не найдено</p>
                ) : (
                  analytics.missingByDocType.map(([docType, count]) => (
                    <div key={docType} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{docType}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Последняя активность</h2>
          </div>
          <div className="mt-3">
            {events.length === 0 ? (
              <EmptyState text="Недавние события не найдены." />
            ) : (
              <div className="divide-y divide-border">
                {events.slice(0, 5).map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-4 p-4">
                    <div>
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.equipment.name} - {event.actor?.displayName || "Система"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Очередь согласований</h2>
          </div>
          <div className="mt-3 space-y-3">
            {pendingApprovals.length === 0 ? (
              <EmptyState text="Нет ожидающих согласований." />
            ) : (
              pendingApprovals.map((item) => (
                <div key={item.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-primary">{item.id.slice(0, 8)}</span>
                    <Badge className="border-0 bg-status-warning/20 text-status-warning">Ожидает</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.comments || "Заявка на согласование"}</p>
                </div>
              ))
            )}
            <Link href="/approval-queue">
              <Button variant="outline" className="w-full">Открыть очередь согласований</Button>
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Критические объекты</h2>
          </div>
          <div className="mt-3">
            {analytics.attention.length === 0 ? (
              <EmptyState text="Критические объекты не выявлены." />
            ) : (
              <div className="divide-y divide-border">
                {analytics.attention.map(({ item, reasons }) => (
                  <div key={item.id} className="p-4">
                    <Link href={`/equipment/${item.id}`} className="font-medium text-primary hover:underline">
                      {item.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{item.department || "Подразделение не задано"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {reasons.slice(0, 3).map((reason) => (
                        <Badge key={`${item.id}-${reason}`} className="border-0 bg-status-error/15 text-status-error">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Статусы согласований</h2>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Черновики</span>
              <span className="font-semibold">{analytics.approvalsByStatus.DRAFT}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ожидают решения</span>
              <span className="font-semibold">{analytics.approvalsByStatus.PENDING}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Согласовано</span>
              <span className="font-semibold">{analytics.approvalsByStatus.APPROVED}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Отклонено</span>
              <span className="font-semibold">{analytics.approvalsByStatus.REJECTED}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Отменено</span>
              <span className="font-semibold">{analytics.approvalsByStatus.CANCELED}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ближайшее и просроченное обслуживание</h2>
        </div>
        <div className="mt-3">
          {upcomingMaintenance.length === 0 && analytics.overdueMaintenance.length === 0 ? (
            <EmptyState text="Нет ближайших задач по обслуживанию." />
          ) : (
            <div className="divide-y divide-border">
              {[...analytics.overdueMaintenance, ...upcomingMaintenance.filter((item) => !isOverdue(item.serviceDueDate))].map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4">
                  <div>
                    <Link href={`/equipment/${item.id}`} className="font-medium text-primary hover:underline">{item.name}</Link>
                    <p className="text-sm text-muted-foreground">Дата ТО: {item.serviceDueDate?.slice(0, 10)}</p>
                  </div>
                  <Badge className={`border-0 ${isOverdue(item.serviceDueDate) ? "bg-status-error/20 text-status-error" : "bg-status-warning/20 text-status-warning"}`}>
                    {isOverdue(item.serviceDueDate) ? "Просрочено" : "Скоро"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
