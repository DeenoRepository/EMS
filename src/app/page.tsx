"use client";

import { useState } from "react";
import Link from "next/link";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Box,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Database,
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
} from "lucide-react";

const platforms = [
  {
    code: "EPS",
    name: "EPS Паспортизация",
    owner: "Служба Главного Механика",
    status: "Активен",
    version: "v1.6.0",
    action: "Открыть",
    href: "/modules/eps",
    icon: Server,
  },
  {
    code: "MRO",
    name: "MRO (ТОиР)",
    owner: "Отдел Эксплуатации",
    status: "В разработке",
    version: "v1.4.2",
    action: "Скоро",
    href: "/modules/mro",
    icon: Settings2,
  },
  {
    code: "SMR",
    name: "SMR Завод",
    owner: "Департамент Закупок",
    status: "В разработке",
    version: "v0.5.8-dev",
    action: "Скоро",
    href: "/modules/srm",
    icon: Box,
  },
  {
    code: "WMS",
    name: "WMS Склад",
    owner: "Складское Хозяйство",
    status: "В разработке",
    version: "v0.1.2-dev",
    action: "Скоро",
    href: "/modules/wms",
    icon: Database,
  },
];

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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,.025)]">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
          {label}
        </span>
        <div className={`rounded-md p-1.5 ${tone}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="mt-2 text-[22px] font-bold tracking-tight text-[#17243a]">
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-[#eef5ff] text-[#3473d4]">
        <Icon size={14} />
      </div>
      <h3 className="text-[12px] font-bold">{title}</h3>
      <p className="mt-1.5 min-h-[30px] text-[10px] leading-relaxed text-slate-500">
        {description}
      </p>
      <Link
        href={href}
        className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-[#3473d4]"
      >
        {link} <ChevronRight size={12} />
      </Link>
    </div>
  );
}

export default function ShellDashboard() {
  const [search] = useState("");

  const visiblePlatforms = platforms.filter((platform) =>
    `${platform.name} ${platform.owner}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-400">
              <span>Главная</span>
              <ChevronRight size={12} />
              <span className="text-[#3473d4]">Обзор платформы</span>
            </div>
            <h1 className="text-[25px] font-bold tracking-[-.03em] text-[#17243a]">
              Панель управления EMS Enterprise
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Мониторинг процессов, доступ к модулям и параметры безопасности в
              едином рабочем контуре.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
              <RefreshCw size={13} /> Обновить
            </button>
            <Link
              href="/modules/eps/new"
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
            >
              <Plus size={14} /> Новый паспорт
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Оборудование EPS"
            value="1 248 ед."
            detail="↗ 12 подключено за месяц"
            icon={Server}
            tone="bg-blue-50 text-blue-500"
          />
          <MetricCard
            label="Открытые ТМР (МРП)"
            value="14 заявок"
            detail="2 ожидают приоритета"
            icon={ClipboardCheck}
            tone="bg-violet-50 text-violet-500"
          />
          <MetricCard
            label="Загрузка Shell"
            value="18.4%"
            detail="класс A / узлы в норме"
            icon={Gauge}
            tone="bg-amber-50 text-amber-500"
          />
          <MetricCard
            label="Безопасность Zero Trust"
            value="100%"
            detail="0 инцидентов"
            icon={ShieldCheck}
            tone="bg-emerald-50 text-emerald-500"
          />
        </div>

        <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.025)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-blue-50 p-1.5 text-blue-500">
                <Network size={15} />
              </div>
              <div>
                <h2 className="text-[13px] font-bold">
                  Реестр модулей платформы
                </h2>
                <p className="text-[10px] text-slate-400">
                  Доступные бизнес-модули и их текущее состояние
                </p>
              </div>
            </div>
            <button className="flex items-center gap-1.5 self-start rounded-md border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
              <SlidersHorizontal size={12} /> Фильтры
            </button>
          </div>

          <div className="hidden grid-cols-[.7fr_2fr_1.8fr_1fr_1fr_1fr] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400 md:grid">
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
              className="grid gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 md:grid-cols-[.7fr_2fr_1.8fr_1fr_1fr_1fr] md:items-center md:gap-4"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-[9px] font-bold text-slate-500">
                  {platform.code}
                </div>
                <span className="text-[10px] text-slate-400 md:hidden">
                  {platform.name}
                </span>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <platform.icon size={14} className="text-slate-400" />
                <span className="text-[11px] font-semibold">
                  {platform.name}
                </span>
              </div>
              <div className="hidden text-[11px] text-slate-500 md:block">
                {platform.owner}
              </div>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-semibold ${
                    platform.status === "Активен"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-500"
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
              <div className="hidden text-[11px] text-slate-500 md:block">
                {platform.version}
              </div>
              <div className="flex items-center justify-between md:justify-end">
                <span className="text-[10px] text-slate-400 md:hidden">
                  {platform.owner}
                </span>
                {platform.action === "Открыть" ? (
                  <Link
                    href={platform.href}
                    className="text-[10px] font-semibold text-[#3473d4] hover:text-blue-700"
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

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <QuickAction
            icon={FileText}
            title="Паспортизация EPS"
            description="Быстрый поиск, редактирование и проверка паспортов оборудования."
            link="Перейти в реестр EPS"
            href="/modules/eps"
          />
          <QuickAction
            icon={ShieldCheck}
            title="Безопасность & RBAC"
            description="Мониторинг доступа и управление матрицей ролей пользователей."
            link="Управление доступом"
            href="/admin/audit"
          />
          <QuickAction
            icon={ClipboardCheck}
            title="Согласования EPS"
            description="Проверка и согласование изменений параметров и паспортов."
            link="Открыть очередь"
            href="/modules/eps/approval-queue"
          />
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5 text-[10px] text-slate-400">
          <span>EMS Enterprise · Версия 1.6.0</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5 cursor-pointer">
              <CircleHelp size={12} /> Центр помощи
            </span>
            <span className="flex items-center gap-1.5 cursor-pointer">
              <LifeBuoy size={12} /> Поддержка
            </span>
          </div>
        </div>
      </main>
    </ShellLayout>
  );
}
