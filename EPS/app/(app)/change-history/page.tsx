"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { SummaryCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { ErrorState } from "@/components/states/error-state";
import { exportToCsv } from "@/lib/export/csv";
import { Download, FileText, Filter, Search, Settings2, Wrench } from "lucide-react";

type EquipmentVersion = {
  id: string;
  versionNumber: number;
  changeSummary?: string | null;
  createdAt: string;
  createdBy: { displayName: string };
  snapshot: Record<string, unknown>;
};

type EquipmentRow = {
  id: string;
  equipmentCode: string;
  name: string;
};

type EquipmentDetails = {
  id: string;
  name: string;
  equipmentCode: string;
  versions: EquipmentVersion[];
};

type ChangeHistoryEvent = {
  id: string;
  equipmentId: string;
  eventType: string;
  title: string;
  description?: string | null;
  payload?: unknown;
  createdAt: string;
  equipment: {
    id: string;
    equipmentCode: string;
    name: string;
  };
  actor?: {
    displayName?: string | null;
    email?: string | null;
  } | null;
};

type TimelineItem = {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  eventType: string;
  approvalStatus?: "APPROVED" | "REJECTED";
  equipmentName: string;
  versionNumber: number | null;
  changedBy: string;
  changedAt: string;
  changeComment: string;
  fieldChanges: Array<{ field: string; before: string; after: string }>;
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

function eventTypeLabel(item: TimelineItem) {
  const map: Record<string, string> = {
    CREATED: "Создано",
    UPDATED: "Обновлено",
    STATUS_CHANGED: "Статус изменен",
    DOCUMENT_ATTACHED: "Документ добавлен",
    APPROVAL_SUBMITTED: "Отправлено на согласование",
    APPROVAL_RESOLVED: "Согласование завершено"
  };
  if (item.eventType === "APPROVAL_RESOLVED" && item.approvalStatus === "APPROVED") return "Согласовано";
  if (item.eventType === "APPROVAL_RESOLVED" && item.approvalStatus === "REJECTED") return "Отклонено";
  return map[item.eventType] || item.eventType;
}

function eventTypeBadgeClass(item: TimelineItem) {
  if (item.eventType === "APPROVAL_RESOLVED" && item.approvalStatus === "REJECTED") return "bg-status-error/20 text-status-error";
  if (item.eventType === "APPROVAL_RESOLVED" && item.approvalStatus === "APPROVED") return "bg-status-success/20 text-status-success";
  if (item.eventType === "APPROVAL_SUBMITTED") return "bg-status-warning/20 text-status-warning";
  if (item.eventType === "STATUS_CHANGED") return "bg-status-warning/20 text-status-warning";
  if (item.eventType === "DOCUMENT_ATTACHED") return "bg-primary/10 text-primary";
  if (item.eventType === "CREATED") return "bg-status-success/15 text-status-success";
  if (item.eventType === "UPDATED") return "bg-muted text-foreground";
  return "bg-muted text-muted-foreground";
}

function cardBorderClass(item: TimelineItem) {
  if (item.eventType === "APPROVAL_RESOLVED" && item.approvalStatus === "REJECTED") return "border-l-status-error";
  if (item.eventType === "APPROVAL_SUBMITTED") return "border-l-status-warning";
  if (item.eventType === "APPROVAL_RESOLVED" && item.approvalStatus === "APPROVED") return "border-l-status-success";
  if (item.eventType === "APPROVAL_RESOLVED") return "border-l-status-warning";
  if (item.eventType === "STATUS_CHANGED") return "border-l-status-warning";
  return "border-l-blue-500";
}

function diffSnapshots(newSnapshot: Record<string, unknown>, oldSnapshot: Record<string, unknown>) {
  const keys = new Set([...Object.keys(newSnapshot), ...Object.keys(oldSnapshot)]);
  const result: Array<{ field: string; before: string; after: string }> = [];
  for (const key of keys) {
    const beforeRaw = oldSnapshot[key];
    const afterRaw = newSnapshot[key];
    if (JSON.stringify(beforeRaw) === JSON.stringify(afterRaw)) continue;
    result.push({
      field: key,
      before: beforeRaw == null ? "-" : String(beforeRaw),
      after: afterRaw == null ? "-" : String(afterRaw)
    });
  }
  return result;
}

export default function ChangeHistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [equipmentFilter, setEquipmentFilter] = useState(() => searchParams.get("equipmentId") || "all");
  const [category, setCategory] = useState(() => searchParams.get("category") || "all");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || 1));
  const [reloadKey, setReloadKey] = useState(0);
  const [total, setTotal] = useState(0);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentRow[]>([]);
  const [compareEquipmentId, setCompareEquipmentId] = useState("");
  const [compareFrom, setCompareFrom] = useState<number | "">("");
  const [compareTo, setCompareTo] = useState<number | "">("");
  const [compareVersions, setCompareVersions] = useState<EquipmentVersion[]>([]);
  const resetFilters = () => {
    setSearch("");
    setEquipmentFilter("all");
    setCategory("all");
    setPage(1);
  };
  const pageSize = 20;

  const buildHistoryUrl = (args: { page: number; pageSize: number; q?: string; equipmentId?: string; category?: string }) => {
    const params = new URLSearchParams({
      page: String(args.page),
      pageSize: String(args.pageSize),
      q: args.q || ""
    });
    if (args.equipmentId && args.equipmentId !== "all") params.set("equipmentId", args.equipmentId);
    if (args.category && args.category !== "all") params.set("category", args.category);
    return `/api/change-history?${params.toString()}`;
  };

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (equipmentFilter !== "all") next.set("equipmentId", equipmentFilter);
    if (category !== "all") next.set("category", category);
    next.set("page", String(page));
    router.replace(`/change-history${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  }, [search, equipmentFilter, category, page, router]);

  useEffect(() => {
    const loadEquipment = async () => {
      try {
        const equipmentRes = await fetch("/api/equipment?page=1&pageSize=300");
        if (!equipmentRes.ok) return;
        const equipmentPayload: Paged<EquipmentRow> = await equipmentRes.json();
        setEquipmentList(equipmentPayload.items || []);
      } catch {
        // ignore
      }
    };
    void loadEquipment();
  }, []);

  useEffect(() => {
    const loadTimeline = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          buildHistoryUrl({
            page,
            pageSize,
            q: search,
            equipmentId: equipmentFilter,
            category
          }),
          { cache: "no-store" }
        );
        if (!res.ok) {
          setError("Не удалось загрузить историю изменений");
          return;
        }
        const data: Paged<ChangeHistoryEvent> = await res.json();
        const rows: TimelineItem[] = (data.items || []).map((event) => {
          const payload = (event.payload || {}) as Record<string, unknown>;
          const payloadVersion = typeof payload.versionNumber === "number" ? payload.versionNumber : null;
          const payloadApprovalStatus =
            payload.approvalStatus === "APPROVED" || payload.approvalStatus === "REJECTED"
              ? payload.approvalStatus
              : undefined;
          const titleVersion = (() => {
            const match = (event.title || "").match(/v(\d+)/i);
            if (!match) return null;
            const parsed = Number(match[1]);
            return Number.isFinite(parsed) ? parsed : null;
          })();
          const versionNumber = payloadVersion ?? titleVersion ?? null;
          const changedBy =
            event.actor?.displayName ||
            event.actor?.email ||
            "Система";
          const changeComment = event.description || event.title || "Без комментария";
          return {
            id: event.id,
            equipmentId: event.equipmentId,
            equipmentCode: event.equipment?.equipmentCode || "",
            eventType: event.eventType,
            approvalStatus: payloadApprovalStatus,
            equipmentName: event.equipment?.name || "Оборудование",
            versionNumber,
            changedBy,
            changedAt: event.createdAt,
            changeComment,
            fieldChanges: []
          };
        });

        setTimeline(rows);
        setTotal(data.total || 0);
      } catch {
        setError("Сетевая ошибка при загрузке истории изменений");
      } finally {
        setLoading(false);
      }
    };
    void loadTimeline();
  }, [search, equipmentFilter, category, page, reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [search, equipmentFilter, category]);

  useEffect(() => {
    const loadCompareVersions = async () => {
      if (!compareEquipmentId) {
        setCompareVersions([]);
        return;
      }
      const res = await fetch(`/api/equipment/${compareEquipmentId}`);
      if (!res.ok) return;
      const details: EquipmentDetails = await res.json();
      setCompareVersions(details.versions || []);
    };
    void loadCompareVersions();
  }, [compareEquipmentId]);

  const filtered = useMemo(() => timeline, [timeline]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const compareDiff = useMemo(() => {
    if (!compareFrom || !compareTo) return [];
    const from = compareVersions.find((version) => version.versionNumber === compareFrom);
    const to = compareVersions.find((version) => version.versionNumber === compareTo);
    if (!from || !to) return [];
    return diffSnapshots(to.snapshot || {}, from.snapshot || {});
  }, [compareFrom, compareTo, compareVersions]);

  const exportCsv = async () => {
    const firstRes = await fetch(
      buildHistoryUrl({
        page: 1,
        pageSize: 100,
        q: search,
        equipmentId: equipmentFilter,
        category
      })
    );
    if (!firstRes.ok) return;
    const firstData: Paged<ChangeHistoryEvent> = await firstRes.json();
    const allItems = [...(firstData.items || [])];
    const totalPages = Math.max(1, Math.ceil((firstData.total || 0) / (firstData.pageSize || 100)));

    if (totalPages > 1) {
      const requests: Promise<Response>[] = [];
      for (let idx = 2; idx <= totalPages; idx += 1) {
        requests.push(
          fetch(
            buildHistoryUrl({
              page: idx,
              pageSize: 100,
              q: search,
              equipmentId: equipmentFilter,
              category
            })
          )
        );
      }
      const responses = await Promise.all(requests);
      for (const response of responses) {
        if (!response.ok) continue;
        const payload: Paged<ChangeHistoryEvent> = await response.json();
        allItems.push(...(payload.items || []));
      }
    }

    exportToCsv(
      "change-history.csv",
      allItems.map((event) => ({
        equipmentCode: event.equipment?.equipmentCode || "",
        equipmentName: event.equipment?.name || "",
        eventType: event.eventType,
        changedBy: event.actor?.displayName || event.actor?.email || "Система",
        changedAt: event.createdAt,
        changeComment: event.description || event.title || ""
      }))
    );
  };

  if (loading) return <LoadingState text="Загрузка истории изменений..." />;
  if (error) return <ErrorState text={error} onRetry={() => setReloadKey((prev) => prev + 1)} />;

  const maintenanceCount = filtered.filter((item) => item.eventType === "STATUS_CHANGED" || item.changeComment.toLowerCase().includes("обслуж")).length;
  const approvalCount = filtered.filter((item) => item.eventType === "APPROVAL_SUBMITTED" || item.eventType === "APPROVAL_RESOLVED").length;

  const cardMeta = (item: TimelineItem) => {
    const text = item.changeComment.toLowerCase();
    const changedFields = item.fieldChanges.map((change) => change.field.toLowerCase());

    if (item.eventType === "CREATED" || text.includes("первич") || text.includes("создан") || text.includes("регистрац")) {
      return { code: "CHG-NEW", title: "Карточка создана", icon: FileText };
    }

    if (text.includes("document") || text.includes("документ")) {
      return { code: "CHG-DOC", title: "Документ обновлен", icon: FileText };
    }

    if (
      text.includes("status") ||
      text.includes("статус") ||
      changedFields.includes("status") ||
      changedFields.includes("lifecyclestage")
    ) {
      return { code: "CHG-STS", title: "Статус обновлен", icon: Settings2 };
    }

    if (text.includes("maintenance") || text.includes("обслуж") || text.includes("техобслуж")) {
      return { code: "CHG-MNT", title: "Техобслуживание", icon: Wrench };
    }

    return { code: "CHG-UPD", title: "Карточка оборудования обновлена", icon: Settings2 };
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <Breadcrumbs items={[{ label: "История изменений" }]} />
        <h1 className="mt-4 text-3xl font-bold">История изменений</h1>
        <p className="mt-1 text-muted-foreground">Лента версий карточек оборудования, изменения полей, комментарии и режим сравнения.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Всего изменений" value={total} />
        <SummaryCard label="Изменения статусов/ТО" value={maintenanceCount} />
        <SummaryCard label="События согласования" value={approvalCount} />
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input data-global-search="true" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по оборудованию, пользователю, комментарию или версии..." />
          </div>
          <Button variant={showFilters ? "default" : "outline"} className="gap-2" onClick={() => setShowFilters((prev) => !prev)}>
            <Filter className="h-4 w-4" />
            Фильтры
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Экспорт
          </Button>
          <Button variant="outline" onClick={resetFilters}>Сбросить всё</Button>
        </div>
        {showFilters ? (
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Оборудование</label>
              <AppSelect className="mt-2" value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)}>
                <option value="all">Все оборудование</option>
                {equipmentList.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.equipmentCode} - {row.name}
                  </option>
                ))}
              </AppSelect>
            </div>
            <div>
              <label className="text-sm font-medium">Категория события</label>
              <AppSelect className="mt-2" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">Все события</option>
                <option value="maintenance">Обслуживание</option>
                <option value="approval">Согласование</option>
                <option value="administrative">Документы/админ</option>
                <option value="other">Прочее</option>
              </AppSelect>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Сравнение версий</h3>
          {(compareEquipmentId || compareFrom || compareTo) ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCompareEquipmentId("");
                setCompareFrom("");
                setCompareTo("");
              }}
            >
              Очистить
            </Button>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <AppSelect value={compareEquipmentId} onChange={(e) => setCompareEquipmentId(e.target.value)}>
            <option value="">Выберите оборудование</option>
            {equipmentList.map((row) => (
              <option key={row.id} value={row.id}>
                {row.equipmentCode} - {row.name}
              </option>
            ))}
          </AppSelect>
          <AppSelect value={compareFrom} onChange={(e) => setCompareFrom(Number(e.target.value))} disabled={!compareEquipmentId}>
            <option value="">Из версии</option>
            {compareVersions.map((version) => (
              <option key={version.id} value={version.versionNumber}>
                v{version.versionNumber}
              </option>
            ))}
          </AppSelect>
          <AppSelect value={compareTo} onChange={(e) => setCompareTo(Number(e.target.value))} disabled={!compareEquipmentId}>
            <option value="">В версию</option>
            {compareVersions.map((version) => (
              <option key={version.id} value={version.versionNumber}>
                v{version.versionNumber}
              </option>
            ))}
          </AppSelect>
        </div>
        {compareDiff.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left">Поле</th>
                  <th className="px-3 py-2 text-left">Было</th>
                  <th className="px-3 py-2 text-left">Стало</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {compareDiff.map((row) => (
                  <tr key={row.field}>
                    <td className="px-3 py-2 font-medium">{row.field}</td>
                    <td className="px-3 py-2">{row.before}</td>
                    <td className="px-3 py-2">{row.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Выберите оборудование и две версии для сравнения изменений.</p>
        )}
      </Card>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Показано {filtered.length} из {total} изменений</p>
        {filtered.length === 0 ? (
          <EmptyState text="Записи изменений не найдены." />
        ) : (
          filtered.map((item) => (
            <Card key={item.id} className={`border-l-4 p-4 ${cardBorderClass(item)}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-status-info/10 p-2">
                      {(() => {
                        const Icon = cardMeta(item).icon;
                        return <Icon className="h-4 w-4 text-status-info" />;
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">{cardMeta(item).code}</span>
                        <p className="text-xl font-semibold">{cardMeta(item).title}</p>
                        <Badge className={`border-0 ${eventTypeBadgeClass(item)}`}>{eventTypeLabel(item)}</Badge>
                      </div>
                      <Link href={`/equipment/${item.equipmentId}`} className="mt-1 block text-lg font-medium text-primary hover:underline">
                        {item.equipmentCode ? `${item.equipmentCode} - ` : ""}{item.equipmentName}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">{item.changeComment}</p>
                    </div>
                  </div>

                  {item.fieldChanges.length > 0 ? (
                    <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Детали:</p>
                      <p className="mt-1 text-sm text-foreground">
                        {item.fieldChanges
                          .slice(0, 3)
                          .map((change) => `${change.field}: ${change.before} -> ${change.after}`)
                          .join(". ")}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="min-w-[108px] text-right">
                  <p className="text-sm text-muted-foreground">{new Date(item.changedAt).toISOString().slice(0, 10)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.changedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Автор: {item.changedBy}</p>
                </div>
              </div>
            </Card>
          ))
        )}
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-4 py-3">
          <span className="text-sm text-muted-foreground">Страница {page} из {pageCount}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Назад</Button>
            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Далее</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
