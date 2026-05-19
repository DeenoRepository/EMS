"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { SummaryCard } from "@/components/ui/summary-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { exportToCsv } from "@/lib/export/csv";
import { useCurrentUser } from "@/lib/client/use-current-user";
import { hasAnyRole } from "@/lib/client/auth";
import { Download, Filter, Lock, Search } from "lucide-react";

type AuditEntry = {
  id: string;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
  createdAt: string;
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

function actionLabel(action: string) {
  const map: Record<string, string> = {
    CREATE: "Создание",
    UPDATE: "Изменение",
    DELETE: "Удаление",
    APPROVE: "Согласование",
    REJECT: "Отклонение",
    LOGIN: "Вход",
    EXPORT: "Экспорт"
  };
  return map[action] || action;
}

function actionBadgeClass(action: string) {
  if (action === "CREATE") return "bg-status-success/20 text-status-success";
  if (action === "UPDATE") return "bg-status-info/20 text-status-info";
  if (action === "DELETE") return "bg-status-error/20 text-status-error";
  if (action === "APPROVE") return "bg-status-success/20 text-status-success";
  if (action === "REJECT") return "bg-status-error/20 text-status-error";
  if (action === "LOGIN") return "bg-primary/10 text-primary";
  if (action === "EXPORT") return "bg-status-warning/20 text-status-warning";
  return "bg-muted text-muted-foreground";
}

const QUICK_ACTIONS = [
  { value: "all", label: "Все" },
  { value: "CREATE", label: "Создание" },
  { value: "UPDATE", label: "Изменение" },
  { value: "DELETE", label: "Удаление" },
  { value: "APPROVE", label: "Согласование" },
  { value: "REJECT", label: "Отклонение" }
];

export default function AuditLogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useCurrentUser();
  const canUse = hasAnyRole(user, ["ADMIN"]);

  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Number(searchParams.get("page") || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [action, setAction] = useState(() => searchParams.get("action") || "all");
  const [actor, setActor] = useState(() => searchParams.get("actor") || "");
  const [entityType, setEntityType] = useState(() => searchParams.get("entityType") || "");
  const [entityId, setEntityId] = useState(() => searchParams.get("entityId") || "");
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(() => searchParams.get("dateTo") || "");

  const pageSize = 20;
  const activeFiltersCount = [action !== "all", Boolean(actor), Boolean(entityType), Boolean(entityId), Boolean(dateFrom), Boolean(dateTo)].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setAction("all");
    setActor("");
    setEntityType("");
    setEntityId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const buildAuditUrl = (args: { page: number; pageSize: number; q?: string; action?: string; actor?: string; entityType?: string; entityId?: string; dateFrom?: string; dateTo?: string }) => {
    const params = new URLSearchParams({
      page: String(args.page),
      pageSize: String(args.pageSize),
      q: args.q || ""
    });
    if (args.action && args.action !== "all") params.set("action", args.action);
    if (args.actor) params.set("actor", args.actor);
    if (args.entityType) params.set("entityType", args.entityType);
    if (args.entityId) params.set("entityId", args.entityId);
    if (args.dateFrom) params.set("dateFrom", args.dateFrom);
    if (args.dateTo) params.set("dateTo", args.dateTo);
    return `/api/audit?${params.toString()}`;
  };

  const load = async () => {
    if (!canUse) {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        buildAuditUrl({
          page,
          pageSize,
          q: search,
          action,
          actor,
          entityType,
          entityId,
          dateFrom,
          dateTo
        })
      );
      if (!res.ok) {
        setError("Не удалось загрузить журнал аудита");
        return;
      }
      const data: Paged<AuditEntry> = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setError("Сетевая ошибка при загрузке журнала аудита");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [canUse, page, search, action, actor, entityType, entityId, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [search, action, actor, entityType, entityId, dateFrom, dateTo]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (action !== "all") next.set("action", action);
    if (actor) next.set("actor", actor);
    if (entityType) next.set("entityType", entityType);
    if (entityId) next.set("entityId", entityId);
    if (dateFrom) next.set("dateFrom", dateFrom);
    if (dateTo) next.set("dateTo", dateTo);
    next.set("page", String(page));
    router.replace(`/audit-log${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  }, [search, action, actor, entityType, entityId, dateFrom, dateTo, page, router]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(total, page * pageSize);

  const stats = useMemo(
    () => ({
      total,
      users: new Set(items.map((entry) => entry.actorEmail || "система")).size,
      updates: items.filter((entry) => ["CREATE", "UPDATE", "DELETE"].includes(entry.action)).length,
      approvals: items.filter((entry) => ["APPROVE", "REJECT"].includes(entry.action)).length
    }),
    [items, total]
  );

  const exportCsv = async () => {
    if (!canUse) return;
    const firstRes = await fetch(
      buildAuditUrl({
        page: 1,
        pageSize: 100,
        q: search,
        action,
        actor,
        entityType,
        entityId,
        dateFrom,
        dateTo
      })
    );
    if (!firstRes.ok) return;
    const firstData: Paged<AuditEntry> = await firstRes.json();
    const allItems = [...(firstData.items || [])];
    const totalPages = Math.max(1, Math.ceil((firstData.total || 0) / (firstData.pageSize || 100)));

    if (totalPages > 1) {
      const requests: Promise<Response>[] = [];
      for (let idx = 2; idx <= totalPages; idx += 1) {
        requests.push(
          fetch(
            buildAuditUrl({
              page: idx,
              pageSize: 100,
              q: search,
              action,
              actor,
              entityType,
              entityId,
              dateFrom,
              dateTo
            })
          )
        );
      }
      const responses = await Promise.all(requests);
      for (const response of responses) {
        if (!response.ok) continue;
        const payload: Paged<AuditEntry> = await response.json();
        allItems.push(...(payload.items || []));
      }
    }

    exportToCsv(
      "audit-log.csv",
      allItems.map((entry) => ({
        user: entry.actorEmail || "система",
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        timestamp: entry.createdAt,
        metadata: typeof entry.metadata === "object" ? JSON.stringify(entry.metadata) : String(entry.metadata || "")
      }))
    );
  };

  if (userLoading) {
    return <LoadingState text="Проверка прав доступа..." />;
  }

  if (!canUse) {
    return <ErrorState text="Раздел «Журнал аудита» доступен только роли ADMIN." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Журнал аудита" }]} />
          <h1 className="mt-4 text-3xl font-bold">Журнал аудита</h1>
          <p className="mt-1 text-muted-foreground">Неизменяемый журнал действий системы с корпоративными фильтрами и превью метаданных.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="h-4 w-4" />
          Неизменяемые записи
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard label="Всего записей" value={stats.total} />
        <SummaryCard label="Пользователей (страница)" value={stats.users} />
        <SummaryCard label="CRUD (страница)" value={stats.updates} />
        <SummaryCard label="Согласования (страница)" value={stats.approvals} />
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по пользователю, действию, сущности..." />
          </div>
          <Button variant={showFilters ? "default" : "outline"} className="gap-2" onClick={() => setShowFilters((prev) => !prev)}>
            <Filter className="h-4 w-4" />
            Фильтры {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Экспорт
          </Button>
          <Button variant="outline" onClick={resetFilters}>Сбросить всё</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((option) => (
            <Button key={option.value} size="sm" variant={action === option.value ? "default" : "outline"} onClick={() => setAction(option.value)}>
              {option.label}
            </Button>
          ))}
        </div>

        {showFilters ? (
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Действие</label>
              <AppSelect className="mt-2" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="all">Все</option>
                <option value="CREATE">Создание</option>
                <option value="UPDATE">Изменение</option>
                <option value="DELETE">Удаление</option>
                <option value="APPROVE">Согласование</option>
                <option value="REJECT">Отклонение</option>
                <option value="LOGIN">Вход</option>
                <option value="EXPORT">Экспорт</option>
              </AppSelect>
            </div>
            <div>
              <label className="text-sm font-medium">Пользователь</label>
              <Input className="mt-2" value={actor} onChange={(e) => setActor(e.target.value)} placeholder="пользователь@компания.рф" />
            </div>
            <div>
              <label className="text-sm font-medium">Тип сущности</label>
              <Input className="mt-2" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="Оборудование / Документ / Заявка" />
            </div>
            <div>
              <label className="text-sm font-medium">ID сущности</label>
              <Input className="mt-2" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="Идентификатор сущности" />
            </div>
            <div>
              <label className="text-sm font-medium">Дата с</label>
              <Input className="mt-2" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Дата по</label>
              <Input className="mt-2" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        ) : null}
      </Card>

      {loading ? <LoadingState text="Загрузка записей аудита..." /> : null}
      {!loading && error ? <ErrorState text={error} onRetry={() => void load()} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState text="По текущим фильтрам записи аудита не найдены." /> : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Показаны записи {startItem}-{endItem} из {total}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left">Пользователь</th>
                  <th className="px-4 py-3 text-left">Действие</th>
                  <th className="px-4 py-3 text-left">Тип сущности</th>
                  <th className="px-4 py-3 text-left">ID сущности</th>
                  <th className="px-4 py-3 text-left">Время</th>
                  <th className="px-4 py-3 text-left">Метаданные (превью)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">{entry.actorEmail || "система"}</td>
                    <td className="px-4 py-3">
                      <Badge className={`border-0 ${actionBadgeClass(entry.action)}`}>
                        {actionLabel(entry.action)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{entry.entityType}</td>
                    <td className="px-4 py-3 font-mono text-xs" title={entry.entityId}>
                      {entry.entityId.slice(0, 16)}{entry.entityId.length > 16 ? "..." : ""}
                    </td>
                    <td className="px-4 py-3">
                      <p>{new Date(entry.createdAt).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <code className="rounded bg-muted/30 px-1.5 py-0.5">
                        {entry.metadata ? `${JSON.stringify(entry.metadata).slice(0, 140)}${JSON.stringify(entry.metadata).length > 140 ? "..." : ""}` : "-"}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3">
            <span className="text-sm text-muted-foreground">Страница {page} из {pageCount}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Назад</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Далее</Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

