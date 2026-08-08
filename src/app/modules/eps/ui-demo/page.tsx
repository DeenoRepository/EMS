"use client";

import { useState } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  Button,
  Input,
  Select,
  Textarea,
  Checkbox,
  Switch,
  FormField,
  FormSection,
  Modal,
  ModalHeader,
  ModalFooter,
  StatusBadge,
  KpiCard,
  FilterChip,
  SearchInput,
  ColumnToggle,
  AreaChart,
  DonutChart,
  StepChart,
  StepperTimeline,
  BarChart,
  TimelineStepItem,
} from "@/components/ui";
import { Server, Layers, CheckCircle2, AlertCircle, Archive, BarChart3, PieChart, Activity, GitCommit } from "lucide-react";

export default function UiDemoPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [switchVal, setSwitchVal] = useState(true);
  const [checkboxVal, setCheckboxVal] = useState(true);
  const [columns, setColumns] = useState([
    { key: "code", label: "Код / Инв. №", visible: true },
    { key: "name", label: "Наименование", visible: true },
    { key: "status", label: "Статус", visible: true },
  ]);

  const mockTimelineSteps: TimelineStepItem[] = [
    {
      id: "st-1",
      title: "Создание технического паспорта",
      subtitle: "Паспорт оборудования EQ-CNC-2026-01 внесен в реестр",
      timestamp: "01.08.2026 10:00",
      actor: "Иванов И.И. (Главный механик)",
      status: "completed",
      details: "Внесены первичные данные, инвентарный номер INV-440192 и привязка к Цеху №3.",
      metadata: { "Серийный №": "SN-9948271", "Тип": "Обрабатывающий центр" },
    },
    {
      id: "st-2",
      title: "Согласование документации (Инспекция)",
      subtitle: "Проверка руководства по эксплуатации и паспорта шпиндельного узла",
      timestamp: "03.08.2026 14:15",
      actor: "Петров В.С. (Главный энергетик)",
      status: "completed",
      details: "Замечаний к документации не выявлено. Паспорт утвержден.",
    },
    {
      id: "st-3",
      title: "Плановое техническое обслуживание (ТО-1)",
      subtitle: "Замена масляных фильтров и диагностика ЧПУ контроллера",
      timestamp: "08.08.2026 11:30",
      actor: "Сервисная бригада №2",
      status: "in-progress",
      details: "Работы выполняются в соответствии с регламентом ТО-1.",
    },
    {
      id: "st-4",
      title: "Периодическая поверка точности",
      subtitle: "Калибровка геометрии станка и лазерный замер осей",
      timestamp: "Запланировано на 15.09.2026",
      status: "pending",
    },
  ];

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <h1 className="text-2xl font-bold text-[#17243a] dark:text-slate-100">
          UI Controls, Analytical Charts & Stepper Timeline Demo
        </h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <KpiCard label="Всего" value={142} icon={<Layers size={14} />} iconColor="blue" sub="Паспортизировано" />
          <KpiCard label="Активно" value={118} icon={<CheckCircle2 size={14} />} iconColor="emerald" sub="83% от общего" subColor="emerald" />
          <KpiCard label="Резерв" value={19} icon={<AlertCircle size={14} />} iconColor="amber" sub="В подготовке" subColor="amber" />
          <KpiCard label="Списано" value={5} icon={<Archive size={14} />} iconColor="slate" sub="В архиве" />
        </div>

        {/* Analytical Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Area Chart Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-[#3473d4]" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Динамика выработки оборудования (AreaChart)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">2026 год</span>
            </div>
            <AreaChart
              data={[
                { label: "Янв", value: 120 },
                { label: "Фев", value: 145 },
                { label: "Мар", value: 130 },
                { label: "Апр", value: 190 },
                { label: "Май", value: 210 },
                { label: "Июн", value: 185 },
                { label: "Июл", value: 240 },
                { label: "Авг", value: 265 },
              ]}
              color="blue"
              valueSuffix=" ч."
              height={180}
            />
          </div>

          {/* Donut Chart Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <PieChart size={16} className="text-emerald-500" />
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Распределение парка по статусам (DonutChart)
              </h3>
            </div>
            <DonutChart
              data={[
                { label: "В эксплуатации", value: 118, color: "#10b981" },
                { label: "Техническое обслуживание", value: 19, color: "#f59e0b" },
                { label: "Списано / Архив", value: 5, color: "#94a3b8" },
              ]}
              centerTitle="142"
              centerSubtitle="Единиц"
            />
          </div>
        </div>

        {/* Step Chart & Bar Chart Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Step Line Chart */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-amber-500" />
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Переключение этапов жизненного цикла (StepChart)
              </h3>
            </div>
            <StepChart
              data={[
                { label: "Ввод данных", stage: "Планирование", stageLevel: 1, timestamp: "01.03.2024", note: "Паспорт создан" },
                { label: "Монтаж", stage: "Ввод в эксплуатацию", stageLevel: 2, timestamp: "15.04.2024", note: "Акт приема-передачи" },
                { label: "Работа", stage: "В эксплуатации", stageLevel: 3, timestamp: "01.05.2024", note: "Штатный режим" },
                { label: "Сервис", stage: "Техобслуживание", stageLevel: 4, timestamp: "10.08.2026", note: "Замена масел" },
              ]}
              height={160}
            />
          </div>

          {/* Bar Chart */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-500" />
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                Нагрузка по подразделениям (BarChart)
              </h3>
            </div>
            <BarChart
              data={[
                { label: "Цех №1", value: 45, color: "#3b82f6" },
                { label: "Цех №2", value: 32, color: "#10b981" },
                { label: "Цех №3", value: 58, color: "#6366f1" },
                { label: "Энергоцех", value: 18, color: "#f59e0b" },
              ]}
              layout="horizontal"
            />
          </div>
        </div>

        {/* Stepper Timeline Section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <GitCommit size={16} className="text-[#3473d4]" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Пошаговый интерактивный таймлайн процесса (StepperTimeline)
            </h3>
          </div>
          <StepperTimeline steps={mockTimelineSteps} />
        </div>

        {/* Status Badges */}
        <div className="flex gap-2 items-center flex-wrap">
          <StatusBadge status="ACTIVE" label="ACTIVE (В эксплуатации)" />
          <StatusBadge status="DRAFT" label="DRAFT (Черновик)" />
          <StatusBadge status="INACTIVE" label="INACTIVE (В резерве)" />
          <StatusBadge status="DECOMMISSIONED" label="DECOMMISSIONED (Списано)" />
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <SearchInput value={searchValue} onChange={setSearchValue} placeholder="Тестовый поиск..." className="max-w-xs" />
          <Select active={searchValue !== ""} className="w-auto shrink-0">
            <option value="ALL">Все фильтры</option>
            <option value="ACTIVE">Активные</option>
          </Select>
          <ColumnToggle
            columns={columns}
            onToggle={(key) => setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)))}
            onReset={() => setColumns((prev) => prev.map((c) => ({ ...c, visible: true })))}
          />
          <Button
            onClick={() => setModalOpen(true)}
            className="shrink-0"
          >
            Открыть демо-модалку
          </Button>
        </div>

        {searchValue && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Активный чип:</span>
            <FilterChip label={`Поиск: "${searchValue}"`} onRemove={() => setSearchValue("")} />
          </div>
        )}

        {/* Form Controls */}
        <FormSection title="1. Пример единой секции формы" icon={<Server size={14} className="text-[#3473d4]" />} cols={2}>
          <FormField label="Текстовое поле" required hint="Заполните код">
            <Input placeholder="EQ-991823" mono />
          </FormField>
          <FormField label="Выпадающий список">
            <Select>
              <option value="1">Отечественное</option>
              <option value="2">Импортное</option>
            </Select>
          </FormField>
          <FormField label="Переключатели" className="col-span-2 flex items-center gap-6">
            <Checkbox label="Уникальное оборудование" checked={checkboxVal} onChange={(e) => setCheckboxVal(e.target.checked)} />
            <Switch label="Активный статус" checked={switchVal} onChange={setSwitchVal} />
          </FormField>
          <FormField label="Примечание" className="col-span-2">
            <Textarea rows={2} placeholder="Введите описание..." />
          </FormField>
        </FormSection>

        {/* Modal Window */}
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="lg">
          <ModalHeader icon={<Server size={16} />} title="Тестовое модальное окно" subtitle="Проверка единого компонента Modal" onClose={() => setModalOpen(false)} />
          <div className="py-4 space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Это модальное окно построено на базе универсальной системы Modals & Controls!
            </p>
          </div>
          <ModalFooter onCancel={() => setModalOpen(false)} onSubmit={() => setModalOpen(false)} submitLabel="Принять" />
        </Modal>
      </main>
    </ShellLayout>
  );
}
