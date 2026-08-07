"use client";

import ShellLayout from "@/components/layout/shell-layout";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PackageCheck, Clock, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { APP_VERSION } from "@/lib/version";

export default function SRMModulePage() {
  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8">
        <Breadcrumbs items={[{ label: "Модули", href: "/modules/eps" }, { label: "SRM Завод" }]} />

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500 mb-4">
            <PackageCheck size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17243a]">
            Модуль SRM (Закупки и управление поставщиками)
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl leading-relaxed">
            Модуль автоматизации заявок на закупку комплектующих, взаимодействия с поставщиками и согласования сметного расчета.
          </p>

          <div className="mt-6 flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 max-w-xl">
            <Clock size={16} className="text-blue-500 shrink-0" />
            <span>Статус разработки: <strong>v{APP_VERSION}-dev</strong>. Плановый релиз в следующем спринте.</span>
          </div>

          <div className="mt-8 flex gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50"
            >
              <ArrowLeft size={14} /> На главную
            </Link>
            <Link
              href="/modules/eps"
              className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#2565c8]"
            >
              Перейти в реестр EPS <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </main>
    </ShellLayout>
  );
}
