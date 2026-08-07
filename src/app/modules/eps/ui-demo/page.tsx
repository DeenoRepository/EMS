"use client";

import { useState } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
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
} from "@/components/ui";
import { Server, Layers, CheckCircle2, AlertCircle, Archive } from "lucide-react";

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

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <h1 className="text-2xl font-bold text-[#17243a] dark:text-slate-100">
          UI Controls & Modal System Demo
        </h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <KpiCard label="Всего" value={142} icon={<Layers size={14} />} iconColor="blue" sub="Паспортизировано" />
          <KpiCard label="Активно" value={118} icon={<CheckCircle2 size={14} />} iconColor="emerald" sub="83% от общего" subColor="emerald" />
          <KpiCard label="Резерв" value={19} icon={<AlertCircle size={14} />} iconColor="amber" sub="В подготовке" subColor="amber" />
          <KpiCard label="Списано" value={5} icon={<Archive size={14} />} iconColor="slate" sub="В архиве" />
        </div>

        {/* Status Badges */}
        <div className="flex gap-2 items-center flex-wrap">
          <StatusBadge status="ACTIVE" label="ACTIVE (В эксплуатации)" />
          <StatusBadge status="DRAFT" label="DRAFT (Черновик)" />
          <StatusBadge status="INACTIVE" label="INACTIVE (В резерве)" />
          <StatusBadge status="DECOMMISSIONED" label="DECOMMISSIONED (Списано)" />
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <SearchInput value={searchValue} onChange={setSearchValue} placeholder="Тестовый поиск..." className="max-w-xs" />
          <Select active={searchValue !== ""}>
            <option value="ALL">Все фильтры</option>
            <option value="ACTIVE">Активные</option>
          </Select>
          <ColumnToggle
            columns={columns}
            onToggle={(key) => setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)))}
            onReset={() => setColumns((prev) => prev.map((c) => ({ ...c, visible: true })))}
          />
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-[#2565c8]"
          >
            Открыть демо-модалку
          </button>
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
