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
  Gauge,
  LifeBuoy,
  Network,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Warehouse,
  ArrowLeftRight,
} from "lucide-react";

interface DashboardMetrics {
  equipmentTotal: number;
  equipmentActive: number;
  approvalPendingCount: number;
  wmsRequisitionsCount: number;
  auditCount: number;
  loading: boolean;
}

const MODULE_ICONS: Record<string, typeof Server> = {
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

  // Dynamic modules list combining MODULES_CONFIG and static dev modules
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
      <main className="w-full px-5 py-6 md:px-8">
        {/* Header */}
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <span>Главная</span>
              <ChevronRight size={12} />
              <span className="text-[#3473d4]">Обзор платформы</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a] dark:text-white">
              Панель управления EMS Enterprise
            </h1>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
              Мониторинг процессов, онлайн-метрики и доступ к бизнес-модулям в едином рабочем контуре.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadDashboardData}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-blue-500" : ""} /> Обновить
            </button>
            <Link
              href="/modules/eps/new"
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
            >
              <Plus size={14} /> Новый паспорт
            </Link>
          </div>
        </div>

        {/* Live System Metrics Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Оборудование EPS"
            value={metrics.loading ? "..." : `${metrics.equipmentTotal} ед.`}
            detail={metrics.loading ? "Загрузка..." : `${metrics.equipmentActive} ед. в эксплуатации`}
            icon={Server}
            tone="bg-blue-50 text-blue-500 dark:bg-blue-950/50"
          />
          <MetricCard
            label="Заявки на согласование"
            value={metrics.loading ? "..." : `${metrics.approvalPendingCount} в очереди`}
            detail="Ожидают решения согласующих"
            icon={ClipboardCheck}
            tone="bg-violet-50 text-violet-500 dark:bg-violet-950/50"
          />
          <MetricCard
            label="Запросы складов (WMS)"
            value={metrics.loading ? "..." : `${metrics.wmsRequisitionsCount} активных`}
            detail="Межскладские перемещения"
            icon={ArrowLeftRight}
            tone="bg-amber-50 text-amber-500 dark:bg-amber-950/50"
          />
          <MetricCard
            label="Безопасность Zero Trust"
            value="100%"
            detail="RBAC Сессия активна"
            icon={ShieldCheck}
            tone="bg-emerald-50 text-emerald-500 dark:bg-emerald-950/50"
          />
        </div>

        {/* Modules Registry Section */}
        <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-blue-50 p-1.5 text-blue-500 dark:bg-blue-950">
                <Network size={15} />
              </div>
              <div>
                <h2 className="text-[13px] font-bold dark:text-white">
                  Реестр модулей платформы
                </h2>
                <p className="text-[10px] text-slate-400">
                  Доступные корпоративные подсистемы и их текущий статус
                </p>
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Фильтр по наименованию..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="hidden grid-cols-[.7fr_2fr_1.8fr_1fr_1fr_1fr] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid dark:border-slate-800 dark:bg-slate-800/40">
            <span>Код</span>
            <span>Наименование модуля</span>
            <span>Ответственное подразделение</span>
            <span>Статус</span>
            <span>Версия</span>
            <span className="text-right">Действия</span>
          </div>

          {visiblePlatforms.map((platform) => (
            <div
              key={platform.code}
              className="grid gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 md:grid-cols-[.7fr_2fr_1.8fr_1fr_1fr_1fr] md:items-center md:gap-4 dark:border-slate-800"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {platform.code}
                </div>
                <span className="text-[10px] text-slate-400 md:hidden">
                  {platform.name}
                </span>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <platform.icon size={14} className="text-slate-400" />
                <span className="text-[11px] font-semibold dark:text-slate-200">
                  {platform.name}
                </span>
              </div>
              <div className="hidden text-[11px] text-slate-500 dark:text-slate-400 md:block">
                {platform.owner}
              </div>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-semibold ${
                    platform.status === "Активен"
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      platform.status === "Активен"
                        ? "bg-emerald-500"
                        : "bg-slate-400"
                    }`}
                  />
                  {platform.status}
                </span>
              </div>
              <div className="hidden text-[11px] text-slate-500 dark:text-slate-400 md:block font-mono">
                {platform.version}
              </div>
              <div className="flex items-center justify-between md:justify-end">
                <span className="text-[10px] text-slate-400 md:hidden">
                  {platform.owner}
                </span>
                {platform.action === "Открыть" ? (
                  <Link
                    href={platform.href}
                    className="text-[10px] font-semibold text-[#3473d4] hover:text-blue-700 dark:text-blue-400"
                  >
                    Открыть <ChevronRight size={11} className="inline" />
                  </Link>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400">
                    Скоро
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Quick Access Actions Grid */}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
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
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5 text-[10px] text-slate-400 dark:border-slate-800">
          <span>EMS Enterprise · Корпоративный контур</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5 cursor-pointer hover:text-slate-600">
              <CircleHelp size={12} /> Центр помощи
            </span>
            <span className="flex items-center gap-1.5 cursor-pointer hover:text-slate-600">
              <LifeBuoy size={12} /> Поддержка
            </span>
          </div>
        </div>
      </main>
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
  icon: typeof Server;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)] dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
          {label}
        </span>
        <div className={`rounded-md p-1.5 ${tone}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a] dark:text-white">
        {value}
      </div>
      <div className="mt-1 text-[10px] text-slate-400">{detail}</div>
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
  icon: typeof FileText;
  title: string;
  description: string;
  link: string;
  href: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-[#eef5ff] text-[#3473d4] dark:bg-blue-950 dark:text-blue-400">
        <Icon size={14} />
      </div>
      <h3 className="text-[12px] font-bold dark:text-white">{title}</h3>
      <p className="mt-1.5 min-h-[30px] text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
        {description}
      </p>
      <Link
        href={href}
        className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-[#3473d4] dark:text-blue-400"
      >
        {link} <ChevronRight size={12} />
      </Link>
    </div>
  );
}
