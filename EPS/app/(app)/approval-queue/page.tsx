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
import { Textarea } from "@/components/ui/textarea";
import { SummaryCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { hasAnyRole } from "@/lib/client/auth";
import { Check, Download, FileText, Filter, RotateCcw, Search, Settings2, X } from "lucide-react";
import { exportToCsv } from "@/lib/export/csv";
import { notifyError, notifySuccess } from "@/lib/client/notify";
import { ESCAPE_EVENT } from "@/components/layout/app-hotkeys";

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
  return value === "EQUIPMENT_VERSION" ? "Версия оборудования" : "Версия документа";
}

function requestIcon(targetType: Approval["targetType"]) {
  if (targetType === "DOCUMENT_VERSION") return FileText;
  return Settings2;
}

function requestIconClass(targetType: Approval["targetType"]) {
  if (targetType === "DOCUMENT_VERSION") return "bg-primary/10 text-primary";
  return "bg-status-info/10 text-status-info";
}

function approvalCommentForUi(raw?: string | null) {
  if (!raw?.trim()) return "";
  const text = raw.trim();
  if (text.startsWith("[MAINTENANCE_EXIT:")) {
    const markerEnd = text.indexOf("]");
    const content = markerEnd >= 0 ? text.slice(markerEnd + 1).trim() : "";
    const decisionIndex = content.indexOf("\n[DECISION]:");
    const userPart = decisionIndex >= 0 ? content.slice(0, decisionIndex).trim() : content;
    return userPart || "Вывод из технического обслуживания";
  }
  if (text.startsWith("[PPR_PLAN:")) {
    const markerEnd = text.indexOf("]");
    const content = markerEnd >= 0 ? text.slice(markerEnd + 1).trim() : "";
    const decisionIndex = content.indexOf("\n[DECISION]:");
    const payloadPart = decisionIndex >= 0 ? content.slice(0, decisionIndex).trim() : content;
    try {
      const parsed = JSON.parse(payloadPart) as { comments?: string };
      return parsed.comments?.trim() || "Обновление графика ППР";
    } catch {
      return "Обновление графика ППР";
    }
  }
  const decisionIndex = text.indexOf("\n[DECISION]:");
  if (decisionIndex >= 0) {
    return text.slice(0, decisionIndex).trim();
  }
  return text;
}

export default function ApprovalQueuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const canDecide = hasAnyRole(user, ["APPROVER", "ADMIN"]);

  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [status, setStatus] = useState(() => searchParams.get("status") || "PENDING");
  const [targetType, setTargetType] = useState<TargetTypeFilter>(() => (searchParams.get("targetType") as TargetTypeFilter) || "all");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || 1));

  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const [rejectPopoverId, setRejectPopoverId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [stats, setStats] = useState({
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  const buildUrl = (params: {
    page: number;
    pageSize: number;
    status?: string;
    targetType?: TargetTypeFilter;
    q?: string;
  }) => {
    const qs = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
      q: params.q || ""
    });
    if (params.status && params.status !== "all") qs.set("status", params.status);
    if (params.targetType && params.targetType !== "all") qs.set("targetType", params.targetType);
    return `/api/approvals?${qs.toString()}`;
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("PENDING");
    setTargetType("all");
    setPage(1);
  };

  const toggleQuickStatus = (nextStatus: QuickStatus) => {
    setStatus((prev) => (prev === nextStatus ? "all" : nextStatus));
    setPage(1);
  };

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (status !== "all") next.set("status", status);
    if (targetType !== "all") next.set("targetType", targetType);
    if (page > 1) next.set("page", String(page));
    router.replace(`/approval-queue${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  }, [search, status, targetType, page, router]);

  useEffect(() => {
    const onEscape = () => {
      setRejectPopoverId(null);
      setRejectReason("");
    };
    window.addEventListener(ESCAPE_EVENT, onEscape);
    return () => window.removeEventListener(ESCAPE_EVENT, onEscape);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          buildUrl({
            page,
            pageSize,
            status,
            targetType,
            q: search.trim()
          })
        );
        if (!res.ok) {
          setError("Не удалось загрузить согласования");
          return;
        }
        const payload: PagedResponse<Approval> = await res.json();
        setItems(payload.items || []);
        setTotal(payload.total || 0);
      } catch {
        setError("Сетевая ошибка при загрузке согласований");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [search, status, targetType, page, pageSize, reloadKey]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [draftRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
          fetch("/api/approvals?page=1&pageSize=1&status=DRAFT"),
          fetch("/api/approvals?page=1&pageSize=1&status=PENDING"),
          fetch("/api/approvals?page=1&pageSize=1&status=APPROVED"),
          fetch("/api/approvals?page=1&pageSize=1&status=REJECTED")
        ]);
        if (!draftRes.ok || !pendingRes.ok || !approvedRes.ok || !rejectedRes.ok) return;
        const [draftData, pendingData, approvedData, rejectedData] = (await Promise.all([
          draftRes.json(),
          pendingRes.json(),
          approvedRes.json(),
          rejectedRes.json()
        ])) as Array<PagedResponse<Approval>>;
        setStats({
          draft: draftData.total || 0,
          pending: pendingData.total || 0,
          approved: approvedData.total || 0,
          rejected: rejectedData.total || 0
        });
      } catch {
        // ignore
      }
    };
    void loadStats();
  }, [reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [search, status, targetType]);

  const decide = async (id: string, nextStatus: "APPROVED" | "REJECTED", comments?: string) => {
    try {
      const res = await fetch(`/api/approvals/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, comments })
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || "Не удалось выполнить действие согласования");
        notifyError(payload.error || "Не удалось выполнить действие согласования");
        return false;
      }
      notifySuccess(nextStatus === "APPROVED" ? "Заявка согласована" : "Заявка отклонена");
      setReloadKey((prev) => prev + 1);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при согласовании");
      notifyError("Сетевая ошибка при согласовании");
      return false;
    }
  };

  const confirmReject = async (id: string) => {
    const normalized = rejectReason.trim();
    if (!normalized) {
      setError("Причина отклонения обязательна");
      notifyError("Причина отклонения обязательна");
      return;
    }
    const ok = await decide(id, "REJECTED", normalized);
    if (ok) {
      setRejectPopoverId(null);
      setRejectReason("");
    }
  };

  const rollback = async (id: string) => {
    try {
      const res = await fetch(`/api/approvals/${id}/rollback`, { method: "POST" });
      if (!res.ok) {
        setError("Не удалось выполнить откат");
        notifyError("Не удалось выполнить откат");
        return;
      }
      notifySuccess("Откат выполнен");
      setReloadKey((prev) => prev + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сетевая ошибка при откате");
      notifyError("Сетевая ошибка при откате");
    }
  };

  const exportCsv = async () => {
    try {
      const firstRes = await fetch(
        buildUrl({
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
              buildUrl({
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
        "approval-queue.csv",
        rows.map((item) => ({
          id: item.id,
          entityType: targetTypeLabel(item.targetType),
          requestedAction: item.target?.label || targetTypeLabel(item.targetType),
          requester: item.requestedBy.displayName,
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

  const hasActiveFilters = useMemo(() => search || status !== "PENDING" || targetType !== "all", [search, status, targetType]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <Breadcrumbs items={[{ label: "Согласования" }]} />
        <h1 className="mt-4 text-3xl font-bold">Очередь согласований</h1>
        <p className="mt-1 text-muted-foreground">Просматривайте заявки на согласование, фильтруйте очередь и принимайте решения быстрее.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Ожидает согласования" value={stats.pending} />
        <SummaryCard label="Согласовано" value={stats.approved} />
        <SummaryCard label="Отклонено" value={stats.rejected} />
        <SummaryCard label="Черновики" value={stats.draft} />
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
            <Input data-global-search="true" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по инициатору, комментарию или действию..." />
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
                <option value="EQUIPMENT_VERSION">Версия оборудования</option>
                <option value="DOCUMENT_VERSION">Версия документа</option>
              </AppSelect>
            </div>
          </div>
        ) : null}
      </Card>

      {loading ? <LoadingState text="Загрузка очереди согласований..." /> : null}
      {!loading && error ? <ErrorState text={error} onRetry={() => setReloadKey((prev) => prev + 1)} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState text="Нет элементов согласования." actionLabel="Сбросить фильтры" onAction={resetFilters} /> : null}

      {!loading && !error && items.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Показано {items.length} из {total} заявок</p>
          {items.map((item) => (
            <Card key={item.id} className={`border-l-4 p-4 ${statusAccentClass(item.status)}`}>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
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
                          <span className="font-mono text-xs font-semibold text-primary">{item.id.slice(0, 8)}</span>
                          <Badge className="border-0 bg-muted text-foreground">{targetTypeLabel(item.targetType)}</Badge>
                          {statusBadge(item.status)}
                        </div>
                        <p className="mt-2 text-lg font-semibold">{item.target?.documentTitle || item.target?.equipmentName || "Карточка объекта"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.target?.label || "Запрошенное действие"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {approvalCommentForUi(item.comments) ? (
                  <div className="rounded-md border border-status-warning/30 bg-status-warning/5 p-3">
                    <p className="text-xs font-semibold text-status-warning">Комментарий</p>
                    <p className="mt-1 text-sm text-foreground">{approvalCommentForUi(item.comments)}</p>
                  </div>
                ) : null}

                <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Запросил(а): <span className="font-medium text-foreground">{item.requestedBy.displayName}</span> • {new Date(item.submittedAt).toLocaleDateString()}
                  {(item.status === "APPROVED" || item.status === "REJECTED") && item.decidedAt
                    ? ` • Решение: ${item.decidedBy?.displayName || "Система"} (${new Date(item.decidedAt).toLocaleDateString()})`
                    : ""}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {canDecide && item.status === "PENDING" ? (
                    <>
                      <Button size="sm" className="gap-1 bg-status-success hover:bg-status-success/90" onClick={() => void decide(item.id, "APPROVED")}>
                        <Check className="h-3 w-3" />
                        Согласовать
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setError(null);
                          if (rejectPopoverId === item.id) {
                            setRejectPopoverId(null);
                            setRejectReason("");
                            return;
                          }
                          setRejectPopoverId(item.id);
                          setRejectReason("");
                        }}
                      >
                        <X className="h-3 w-3" />
                        Отклонить
                      </Button>
                    </>
                  ) : null}
                  {item.target?.documentId ? (
                    <Link href={`/documents/${item.target.documentId}`}>
                      <Button variant="ghost" size="sm">Открыть объект</Button>
                    </Link>
                  ) : item.target?.equipmentId ? (
                    <Link href={`/equipment/${item.target.equipmentId}`}>
                      <Button variant="ghost" size="sm">Открыть объект</Button>
                    </Link>
                  ) : null}
                  {canDecide && item.status === "APPROVED" && item.targetType === "EQUIPMENT_VERSION" ? (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => void rollback(item.id)}>
                      <RotateCcw className="h-3 w-3" />
                      Откатить
                    </Button>
                  ) : null}
                </div>

                {canDecide && item.status === "PENDING" && rejectPopoverId === item.id ? (
                  <div className="rounded-md border border-status-error/30 bg-status-error/5 p-3">
                    <p className="text-sm font-semibold text-status-error">Причина отклонения</p>
                    <p className="mt-1 text-xs text-muted-foreground">Укажите причину, она будет сохранена в заявке и увидит инициатор.</p>
                    <Textarea
                      className="mt-2 min-h-24 bg-background"
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Например: недостаточно подтверждающих документов, требуется доработка..."
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setRejectPopoverId(null); setRejectReason(""); }}>
                        Отмена
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void confirmReject(item.id)}>
                        Подтвердить отклонение
                      </Button>
                    </div>
                  </div>
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

