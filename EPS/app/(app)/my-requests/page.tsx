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
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { exportToCsv } from "@/lib/export/csv";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { hasAnyRole } from "@/lib/client/auth";
import { Download, Eye, FileText, Filter, Search, Settings2 } from "lucide-react";

type Approval = {
  id: string;
  targetType: "EQUIPMENT_VERSION" | "DOCUMENT_VERSION";
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
  comments?: string | null;
  submittedAt: string;
  decidedAt?: string | null;
  requestedBy: { displayName: string; email: string };
  decidedBy?: { displayName: string; email: string } | null;
  target?: {
    equipmentId?: string;
    equipmentName?: string;
    documentId?: string;
    documentTitle?: string;
    label?: string;
  } | null;
};

type PagedResponse<T> = { items: T[]; total: number; page: number; pageSize: number };
type QuickStatus = "PENDING" | "APPROVED" | "REJECTED" | "DRAFT";
type TargetTypeFilter = "all" | Approval["targetType"];

function targetTypeLabel(value: Approval["targetType"]) {
  return value === "EQUIPMENT_VERSION" ? "Изменение оборудования" : "Изменение документа";
}

function localizeRequestComment(text?: string | null) {
  if (!text) return "";
  const normalized = text.trim();
  if (!normalized) return "";
  if (normalized.startsWith("[MAINTENANCE_EXIT:")) {
    const markerEnd = normalized.indexOf("]");
    const content = markerEnd >= 0 ? normalized.slice(markerEnd + 1).trim() : "";
    const decisionIndex = content.indexOf("\n[DECISION]:");
    const userPart = decisionIndex >= 0 ? content.slice(0, decisionIndex).trim() : content;
    return userPart || "Вывод из технического обслуживания";
  }
  if (normalized.startsWith("[PPR_PLAN:")) {
    const markerEnd = normalized.indexOf("]");
    const content = markerEnd >= 0 ? normalized.slice(markerEnd + 1).trim() : "";
    const decisionIndex = content.indexOf("\n[DECISION]:");
    const payloadPart = decisionIndex >= 0 ? content.slice(0, decisionIndex).trim() : content;
    try {
      const parsed = JSON.parse(payloadPart) as { comments?: string };
      return parsed.comments?.trim() || "Обновление графика ППР";
    } catch {
      return "Обновление графика ППР";
    }
  }
  const decisionIndex = normalized.indexOf("\n[DECISION]:");
  if (decisionIndex >= 0) {
    return normalized.slice(0, decisionIndex).trim();
  }
  const map: Record<string, string> = {
    "Equipment update submitted for approval": "Изменение оборудования отправлено на согласование",
    "New equipment submitted for approval": "Новое оборудование отправлено на согласование",
    "Equipment updated": "Оборудование обновлено",
    "Initial equipment creation": "Первичное создание оборудования",
    "Change submitted for approval": "Изменение отправлено на согласование",
    "Approval skipped by settings": "Согласование отключено настройками"
  };
  return map[normalized] || normalized;
}

function requestIcon(targetType: Approval["targetType"]) {
  if (targetType === "DOCUMENT_VERSION") return FileText;
  return Settings2;
}

function requestIconClass(targetType: Approval["targetType"]) {
  if (targetType === "DOCUMENT_VERSION") return "bg-primary/10 text-primary";
  return "bg-status-info/10 text-status-info";
}

export default function MyRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useCurrentUser();
  const canUse = hasAnyRole(user, ["EDITOR", "ADMIN"]);
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [meEmail, setMeEmail] = useState<string>("");
  const [reloadKey, setReloadKey] = useState(0);

  const [status, setStatus] = useState(() => searchParams.get("status") || "all");
  const [targetType, setTargetType] = useState<TargetTypeFilter>(() => (searchParams.get("targetType") as TargetTypeFilter) || "all");
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || 1));

  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0
  });

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const buildApprovalsUrl = (params: {
    page: number;
    pageSize: number;
    status?: string;
    targetType?: TargetTypeFilter;
    q?: string;
  }) => {
    const qs = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
      requestedByEmail: meEmail
    });
    if (params.status && params.status !== "all") qs.set("status", params.status);
    if (params.targetType && params.targetType !== "all") qs.set("targetType", params.targetType);
    if (params.q) qs.set("q", params.q);
    return `/api/approvals?${qs.toString()}`;
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setTargetType("all");
    setPage(1);
  };

  const toggleQuickStatus = (value: QuickStatus) => {
    setStatus((prev) => (prev === value ? "all" : value));
    setPage(1);
  };

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (status !== "all") next.set("status", status);
    if (targetType !== "all") next.set("targetType", targetType);
    if (page > 1) next.set("page", String(page));
    router.replace(`/my-requests${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  }, [search, status, targetType, page, router]);

  useEffect(() => {
    if (userLoading || !canUse) return;
    const loadMe = async () => {
      try {
        const meRes = await fetch("/api/me");
        if (!meRes.ok) {
          setError("Не удалось загрузить мои заявки");
          return;
        }
        const me: { email: string } = await meRes.json();
        setMeEmail(me.email);
      } catch {
        setError("Сетевая ошибка при загрузке моих заявок");
      }
    };
    void loadMe();
  }, [canUse, userLoading]);

  useEffect(() => {
    if (!canUse || !meEmail) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          buildApprovalsUrl({
            page,
            pageSize,
            status,
            targetType,
            q: search.trim()
          })
        );
        if (!res.ok) {
          setError("Не удалось загрузить мои заявки");
          return;
        }
        const payload: PagedResponse<Approval> = await res.json();
        setItems(payload.items || []);
        setTotal(payload.total || 0);
      } catch {
        setError("Сетевая ошибка при загрузке моих заявок");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [canUse, meEmail, page, pageSize, search, status, targetType, reloadKey]);

  useEffect(() => {
    if (!canUse || !meEmail) return;
    const loadCounts = async () => {
      try {
        const [totalRes, approvedRes, pendingRes, rejectedRes] = await Promise.all([
          fetch(`/api/approvals?page=1&pageSize=1&requestedByEmail=${encodeURIComponent(meEmail)}`),
          fetch(`/api/approvals?page=1&pageSize=1&requestedByEmail=${encodeURIComponent(meEmail)}&status=APPROVED`),
          fetch(`/api/approvals?page=1&pageSize=1&requestedByEmail=${encodeURIComponent(meEmail)}&status=PENDING`),
          fetch(`/api/approvals?page=1&pageSize=1&requestedByEmail=${encodeURIComponent(meEmail)}&status=REJECTED`)
        ]);

        if (!totalRes.ok || !approvedRes.ok || !pendingRes.ok || !rejectedRes.ok) return;

        const [totalData, approvedData, pendingData, rejectedData] = (await Promise.all([
          totalRes.json(),
          approvedRes.json(),
          pendingRes.json(),
          rejectedRes.json()
        ])) as Array<PagedResponse<Approval>>;

        setCounts({
          total: totalData.total || 0,
          approved: approvedData.total || 0,
          pending: pendingData.total || 0,
          rejected: rejectedData.total || 0
        });
      } catch {
        // ignore
      }
    };
    void loadCounts();
  }, [canUse, meEmail]);

  useEffect(() => {
    setPage(1);
  }, [search, status, targetType]);

  const exportCsv = async () => {
    if (!canUse || !meEmail) return;
    try {
      const firstRes = await fetch(
        buildApprovalsUrl({
          page: 1,
          pageSize: 100,
          status,
          targetType,
          q: search.trim()
        })
      );
      if (!firstRes.ok) return;
      const firstPayload: PagedResponse<Approval> = await firstRes.json();
      const rows = [...(firstPayload.items || [])];
      const totalPages = Math.max(1, Math.ceil((firstPayload.total || 0) / (firstPayload.pageSize || 100)));

      if (totalPages > 1) {
        const requests: Promise<Response>[] = [];
        for (let idx = 2; idx <= totalPages; idx += 1) {
          requests.push(
            fetch(
              buildApprovalsUrl({
                page: idx,
                pageSize: 100,
                status,
                targetType,
                q: search.trim()
              })
            )
          );
        }
        const responses = await Promise.all(requests);
        for (const response of responses) {
          if (!response.ok) continue;
          const payload: PagedResponse<Approval> = await response.json();
          rows.push(...(payload.items || []));
        }
      }

      exportToCsv(
        "my-requests.csv",
        rows.map((item) => ({
          id: item.id,
          entityType: targetTypeLabel(item.targetType),
          requestedAction: item.target?.label || targetTypeLabel(item.targetType),
          requestDate: item.submittedAt,
          currentStatus: item.status,
          comment: item.comments || ""
        }))
      );
    } catch {
      // ignore
    }
  };

  const statusBadge = (value: Approval["status"]) => {
    if (value === "APPROVED") return <Badge className="border-0 bg-status-success/20 text-status-success">Согласовано</Badge>;
    if (value === "REJECTED") return <Badge className="border-0 bg-status-error/20 text-status-error">Отклонено</Badge>;
    if (value === "PENDING") return <Badge className="border-0 bg-status-warning/20 text-status-warning">Ожидает</Badge>;
    if (value === "DRAFT") return <Badge className="border-0 bg-status-info/20 text-status-info">Черновик</Badge>;
    return <Badge className="border-0 bg-muted text-muted-foreground">Отменено</Badge>;
  };

  const statusAccentClass = (value: Approval["status"]) => {
    if (value === "APPROVED") return "border-l-status-success";
    if (value === "PENDING") return "border-l-status-warning";
    if (value === "DRAFT") return "border-l-status-info";
    if (value === "REJECTED") return "border-l-status-error";
    return "border-l-border";
  };

  const hasActiveFilters = useMemo(() => search || status !== "all" || targetType !== "all", [search, status, targetType]);

  if (userLoading) {
    return <LoadingState text="Проверка прав доступа..." />;
  }

  if (!canUse) {
    return <ErrorState text="Раздел «Мои заявки» доступен только ролям EDITOR и ADMIN." />;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Breadcrumbs items={[{ label: "Мои заявки" }]} />
        <h1 className="mt-4 text-3xl font-bold">Мои заявки</h1>
        <p className="mt-1 text-muted-foreground">Отслеживайте отправленные заявки и быстро переходите к связанным документам и оборудованию.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Всего заявок" value={counts.total} />
        <SummaryCard label="Согласовано" value={counts.approved} />
        <SummaryCard label="Ожидают" value={counts.pending} />
        <SummaryCard label="Отклонено" value={counts.rejected} />
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={status === "PENDING" ? "default" : "outline"} onClick={() => toggleQuickStatus("PENDING")}>Ожидают</Button>
          <Button size="sm" variant={status === "APPROVED" ? "default" : "outline"} onClick={() => toggleQuickStatus("APPROVED")}>Согласовано</Button>
          <Button size="sm" variant={status === "REJECTED" ? "default" : "outline"} onClick={() => toggleQuickStatus("REJECTED")}>Отклонено</Button>
          <Button size="sm" variant={status === "DRAFT" ? "default" : "outline"} onClick={() => toggleQuickStatus("DRAFT")}>Черновики</Button>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-global-search="true"
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по объекту, комментарию или номеру заявки..."
            />
          </div>
          <Button variant={showFilters ? "default" : "outline"} className="gap-2" onClick={() => setShowFilters((prev) => !prev)}>
            <Filter className="h-4 w-4" />
            Фильтры
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" />
            Экспорт
          </Button>
          <Button variant="outline" onClick={resetFilters} disabled={!hasActiveFilters}>Сбросить всё</Button>
        </div>

        {showFilters ? (
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Статус</label>
              <AppSelect className="mt-2" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">Все</option>
                <option value="DRAFT">Черновик</option>
                <option value="PENDING">Ожидает</option>
                <option value="APPROVED">Согласовано</option>
                <option value="REJECTED">Отклонено</option>
                <option value="CANCELED">Отменено</option>
              </AppSelect>
            </div>
            <div>
              <label className="text-sm font-medium">Тип заявки</label>
              <AppSelect className="mt-2" value={targetType} onChange={(e) => setTargetType(e.target.value as TargetTypeFilter)}>
                <option value="all">Все</option>
                <option value="EQUIPMENT_VERSION">Изменение оборудования</option>
                <option value="DOCUMENT_VERSION">Изменение документа</option>
              </AppSelect>
            </div>
          </div>
        ) : null}
      </Card>

      {loading ? <LoadingState text="Загрузка заявок..." /> : null}
      {!loading && error ? <ErrorState text={error} onRetry={() => setReloadKey((prev) => prev + 1)} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState text="Заявки не найдены." actionLabel="Сбросить фильтры" onAction={resetFilters} /> : null}

      {!loading && !error && items.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Показано {items.length} из {total} заявок</p>
          {items.map((item) => (
            <Card key={item.id} className={`border-l-4 p-4 ${statusAccentClass(item.status)}`}>
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${requestIconClass(item.targetType)}`}>
                      {(() => {
                        const Icon = requestIcon(item.targetType);
                        return <Icon className="h-4 w-4" />;
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">{item.id.slice(0, 8).toUpperCase()}</span>
                        <span className="text-sm text-muted-foreground">{targetTypeLabel(item.targetType)}</span>
                        {statusBadge(item.status)}
                      </div>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {item.target?.documentTitle || item.target?.equipmentName || "Заявка"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{localizeRequestComment(item.comments) || item.target?.label || "Детали заявки"}</p>
                      <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                        Подано: {new Date(item.submittedAt).toLocaleDateString()}
                        {item.status === "APPROVED" || item.status === "REJECTED"
                          ? `   Решение: ${item.decidedBy?.displayName || "Система"} (${new Date(item.decidedAt || item.submittedAt).toLocaleDateString()})`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
                {item.target?.documentId ? (
                  <Link href={`/documents/${item.target.documentId}`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                      <Eye className="h-4 w-4" />
                      Открыть
                    </Button>
                  </Link>
                ) : item.target?.equipmentId ? (
                  <Link href={`/equipment/${item.target.equipmentId}`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                      <Eye className="h-4 w-4" />
                      Открыть
                    </Button>
                  </Link>
                ) : null}
              </div>
            </Card>
          ))}

          <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-4 py-3">
            <span className="text-sm text-muted-foreground">Страница {page} из {pageCount}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Назад</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Далее</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
