"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ShellLayout from "@/components/layout/shell-layout";
import { MODULES_CONFIG } from "@/lib/config/modules";
import {
  Box,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  FileText,
  LifeBuoy,
  Network,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Warehouse,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

interface DashboardMetrics {
  equipmentTotal: number;
  equipmentActive: number;
  approvalPendingCount: number;
  wmsRequisitionsCount: number;
  auditCount: number;
  loading: boolean;
}

const MODULE_ICONS: Record<string, LucideIcon> = {
  Server,
  Warehouse,
  Settings2,
  Box,
};

export default function ShellDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    equipmentTotal: 0,
    equipmentActive: 0,
    approvalPendingCount: 0,
    wmsRequisitionsCount: 0,
    auditCount: 0,
    loading: true,
  });

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [eqRes, apprRes, wmsRes] = await Promise.all([
        fetch("/api/modules/eps/equipment").then((r) => (r.ok ? r.json() : { items: [], total: 0 })),
        fetch("/api/modules/eps/approval-queue/count").then((r) => (r.ok ? r.json() : { count: 0 })),
        fetch("/api/modules/wms/requisitions/count").then((r) => (r.ok ? r.json() : { count: 0 })),
      ]);

      const items = eqRes.items || [];
      const activeCount = items.filter((i: { status: string }) => i.status === "ACTIVE").length;

      setMetrics({
        equipmentTotal: eqRes.total || items.length || 0,
        equipmentActive: activeCount,
        approvalPendingCount: apprRes.count || 0,
        wmsRequisitionsCount: wmsRes.count || 0,
        auditCount: 0,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to load dashboard live metrics:", err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const allModules = [
    {
      code: "EPS",
      name: MODULES_CONFIG.eps?.name || "EPS Паспортизация",
      owner: "Служба Главного Механика",
      status: MODULES_CONFIG.eps?.status === "online" ? "Активен" : "В разработке",
      version: MODULES_CONFIG.eps?.version || "v1.6.0",
      action: "Открыть",
      href: MODULES_CONFIG.eps?.href || "/modules/eps",
      icon: Server,
    },
    {
      code: "WMS",
      name: MODULES_CONFIG.wms?.name || "WMS Складской учет",
      owner: "Складской комплекс / Логистика",
      status: MODULES_CONFIG.wms?.status === "online" ? "Активен" : "В разработке",
      version: MODULES_CONFIG.wms?.version || "v1.0.0",
      action: "Открыть",
      href: MODULES_CONFIG.wms?.href || "/modules/wms",
      icon: Warehouse,
    },
    {
      code: "MRO",
      name: "MRO (ТОиР оборудования)",
      owner: "Отдел Эксплуатации и ТОиР",
      status: "В разработке",
      version: "v1.4.2-dev",
      action: "Скоро",
      href: "#",
      icon: Settings2,
    },
    {
      code: "SMR",
      name: "SMR Заводской учет",
      owner: "Департамент Закупок и СМР",
      status: "В разработке",
      version: "v0.5.8-dev",
      action: "Скоро",
      href: "#",
      icon: Box,
    },
  ];

  const visiblePlatforms = allModules.filter((platform) =>
    `${platform.name} ${platform.owner} ${platform.code}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <ShellLayout>
      <div className="w-full px-4 py-6 md:px-8 space-y-6">
        {/* Header */}
        <PageHeader
          title="Панель управления EMS Enterprise"
          description="Мониторинг процессов, онлайн-метрики и доступ к бизнес-модулям в едином рабочем контуре."
          breadcrumbs={[{ title: "Главная", href: "/" }, { title: "Обзор платформы" }]}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDashboardData}
                disabled={refreshing}
                loading={refreshing}
                loadingText="Обновление..."
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Обновить
              </Button>
              <Button asChild size="sm">
                <Link href="/modules/eps/new">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Новый паспорт
                </Link>
              </Button>
            </>
          }
        />

        {/* Live System Metrics Cards */}
        <section
          aria-label="Ключевые метрики"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <MetricCard
            label="Оборудование EPS"
            value={metrics.loading ? "..." : `${metrics.equipmentTotal} ед.`}
            detail={metrics.loading ? "Загрузка..." : `${metrics.equipmentActive} ед. в эксплуатации`}
            icon={Server}
            tone="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
          />
          <MetricCard
            label="Заявки на согласование"
            value={metrics.loading ? "..." : `${metrics.approvalPendingCount} в очереди`}
            detail="Ожидают решения согласующих"
            icon={ClipboardCheck}
            tone="bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400"
          />
          <MetricCard
            label="Запросы складов (WMS)"
            value={metrics.loading ? "..." : `${metrics.wmsRequisitionsCount} активных`}
            detail="Межскладские перемещения"
            icon={ArrowLeftRight}
            tone="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
          />
          <MetricCard
            label="Безопасность Zero Trust"
            value="100%"
            detail="RBAC Сессия активна"
            icon={ShieldCheck}
            tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
          />
        </section>

        {/* Modules Registry Section */}
        <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Network className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Реестр модулей платформы
                </h2>
                <p className="text-xs text-muted-foreground">
                  Доступные корпоративные подсистемы и их текущий статус
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64">
              <Input
                type="search"
                placeholder="Фильтр по наименованию..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Фильтр модулей"
              />
            </div>
          </div>

          {/* Desktop Table Header */}
          <div className="hidden md:grid grid-cols-[0.7fr_2fr_1.8fr_1fr_1fr_1fr] gap-4 border-b border-border bg-muted/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Код</span>
            <span>Наименование модуля</span>
            <span>Ответственное подразделение</span>
            <span>Статус</span>
            <span>Версия</span>
            <span className="text-right">Действия</span>
          </div>

          {visiblePlatforms.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              Модули не найдены по заданному фильтру
            </div>
          ) : (
            visiblePlatforms.map((platform) => (
              <div
                key={platform.code}
                className="grid gap-2 border-b border-border px-5 py-3.5 last:border-0 md:grid-cols-[0.7fr_2fr_1.8fr_1fr_1fr_1fr] md:items-center md:gap-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
                    {platform.code}
                  </div>
                  <span className="text-xs text-muted-foreground md:hidden">
                    {platform.name}
                  </span>
                </div>
                <div className="hidden items-center gap-2 md:flex">
                  <platform.icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-sm font-semibold text-foreground">
                    {platform.name}
                  </span>
                </div>
                <div className="hidden text-sm text-muted-foreground md:block">
                  {platform.owner}
                </div>
                <div>
                  <StatusBadge
                    status={platform.status === "Активен" ? "ACTIVE" : "DRAFT"}
                    label={platform.status}
                    size="sm"
                  />
                </div>
                <div className="hidden text-sm text-muted-foreground md:block font-mono">
                  {platform.version}
                </div>
                <div className="flex items-center justify-between md:justify-end">
                  <span className="text-xs text-muted-foreground md:hidden">
                    {platform.owner}
                  </span>
                  {platform.action === "Открыть" ? (
                    <Link
                      href={platform.href}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Открыть <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">
                      Скоро
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Quick Access Actions Grid */}
        <section aria-label="Быстрый доступ" className="grid gap-3 md:grid-cols-3">
          <QuickAction
            icon={FileText}
            title="Паспортизация EPS"
            description="Быстрый поиск, редактирование и версионирование паспортов оборудования."
            link="Перейти в реестр EPS"
            href="/modules/eps"
          />
          <QuickAction
            icon={ShieldCheck}
            title="Аудит & Матрица ролей"
            description="Просмотр журналов безопасности, аудита и матрицы ролей пользователей."
            link="Журнал аудита"
            href="/admin/audit"
          />
          <QuickAction
            icon={ClipboardCheck}
            title="Очередь согласований EPS"
            description="Согласование запросов на изменение статусов и параметров паспортов."
            link="Открыть очередь"
            href="/modules/eps/approval-queue"
          />
        </section>

        {/* Footer */}
        <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
          <span>EMS Enterprise · Корпоративный контур</span>
          <div className="flex gap-4">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
              Центр помощи
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
              Поддержка
            </button>
          </div>
        </footer>
      </div>
    </ShellLayout>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className={cn("rounded-md p-1.5 shrink-0", tone)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  description,
  link,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  link: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary transition-transform group-hover:scale-110">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 min-h-[36px] text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:text-primary/80">
        {link} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
