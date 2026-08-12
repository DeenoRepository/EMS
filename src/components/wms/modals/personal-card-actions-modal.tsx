"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader, DataTable } from "@/components/ui";
import { RotateCcw, UserPlus, Users, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { WmsEmployee, WmsPersonalCard } from "@/types/wms";
import { checkDirtyFormClose } from "./wms-modal-utils";

/* -------------------------------------------------------------------------- */
/* 1. Return Personal Item Modal                                              */
/* -------------------------------------------------------------------------- */

interface ReturnPersonalItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  card: WmsPersonalCard | null;
}

export function ReturnPersonalItemModal({
  isOpen,
  onClose,
  onSuccess,
  card
}: ReturnPersonalItemModalProps) {
  const [returnCondition, setReturnCondition] = useState("GOOD");
  const [notes, setNotes] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsDirty(false);
      setErrorMessage(null);
      setReturnCondition("GOOD");
      setNotes("");
    }
  }, [isOpen]);

  const handleSafeClose = () => {
    checkDirtyFormClose(isDirty, onClose);
  };

  if (!isOpen || !card) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/modules/wms/personal-cards/${card.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnCondition, notes })
      });

      if (res.ok) {
        setIsDirty(false);
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Ошибка при оформлении возврата имущества");
      }
    } catch (err) {
      console.error("Failed to return personal card item:", err);
      setErrorMessage("Ошибка сети при отправке возврата");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={handleSafeClose} size="md">
      <ModalHeader
        icon={<RotateCcw size={16} className="text-amber-600" />}
        title="Оформление возврата имущества"
        subtitle={`${card.itemName} от ${card.employeeName} (Таб. №${card.employeeNumber || "Б/Н"})`}
        onClose={handleSafeClose}
      />

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Состояние имущества при возврате *
          </label>
          <select
            value={returnCondition}
            onChange={(e) => {
              setIsDirty(true);
              setReturnCondition(e.target.value);
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="GOOD">Исправно — Возвратить в рабочий остаток склада</option>
            <option value="REPAIR">Требует ремонта — Передать в ТОИР (EPS)</option>
            <option value="SCRAPPED">Списано в утиль / Непригодно — Акт WMS списания</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Заметки осмотра при возврате
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => {
              setIsDirty(true);
              setNotes(e.target.value);
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            placeholder="Укажите степень износа или причину списания..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSafeClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-700 shadow-xs disabled:opacity-50 transition"
          >
            <RotateCcw size={14} />
            <span>{submitting ? "Сохранение..." : "Подтвердить возврат"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Add Employee to WMS Roster Modal                                        */
/* -------------------------------------------------------------------------- */

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddEmployeeModal({
  isOpen,
  onClose,
  onSuccess
}: AddEmployeeModalProps) {
  const [name, setName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [position, setPosition] = useState("Инженер-механик");
  const [department, setDepartment] = useState("Цех №1");
  const [isDirty, setIsDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsDirty(false);
      setErrorMessage(null);
      setName("");
      setEmployeeNumber(`Т-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  }, [isOpen]);

  const handleSafeClose = () => {
    checkDirtyFormClose(isDirty, onClose);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !employeeNumber.trim()) {
      setErrorMessage("Заполните ФИО и табельный номер");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, employeeNumber, position, department })
      });

      if (res.ok) {
        setIsDirty(false);
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Ошибка заведения сотрудника");
      }
    } catch (err) {
      console.error("Failed to add employee:", err);
      setErrorMessage("Ошибка сети при вызове сервера");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={handleSafeClose} size="md">
      <ModalHeader
        icon={<UserPlus size={16} className="text-blue-600" />}
        title="Новый сотрудник в Справочник склада"
        subtitle="Заведение нового материально ответственного лица"
        onClose={handleSafeClose}
      />

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">ФИО Сотрудника *</label>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => {
              setIsDirty(true);
              setName(e.target.value);
            }}
            placeholder="Петров Алексей Сергеевич"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Табельный номер *</label>
          <input
            required
            type="text"
            value={employeeNumber}
            onChange={(e) => {
              setIsDirty(true);
              setEmployeeNumber(e.target.value);
            }}
            placeholder="Т-0899"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-blue-700 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Должность</label>
            <input
              type="text"
              value={position}
              onChange={(e) => {
                setIsDirty(true);
                setPosition(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Цех / Подразделение</label>
            <input
              type="text"
              value={department}
              onChange={(e) => {
                setIsDirty(true);
                setDepartment(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSafeClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs disabled:opacity-50 transition"
          >
            <UserPlus size={14} />
            <span>{submitting ? "Сохранение..." : "Сохранить в Справочник"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Employee Directory Modal                                                */
/* -------------------------------------------------------------------------- */

interface EmployeeDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: WmsEmployee[];
  onAddEmployeeClick: () => void;
  onIssueItemClick: (employeeId: string) => void;
}

export function EmployeeDirectoryModal({
  isOpen,
  onClose,
  employees = [],
  onAddEmployeeClick,
  onIssueItemClick
}: EmployeeDirectoryModalProps) {
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeNumber.toLowerCase().includes(search.toLowerCase()) ||
      (e.department && e.department.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Modal open={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        icon={<Users size={16} className="text-blue-600" />}
        title="Справочник сотрудников склада (МОЛ)"
        subtitle="Перечень материально ответственных лиц предприятитя"
        onClose={onClose}
      />

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ФИО, табельному или цеху..."
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs w-64 focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={onAddEmployeeClick}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <UserPlus size={14} />
            <span>Добавить сотрудника</span>
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <DataTable
            columns={[
              {
                key: "name",
                header: "ФИО Сотрудника",
                cell: (row: WmsEmployee) => (
                  <span className="font-bold text-slate-900 text-xs">{row.name}</span>
                )
              },
              {
                key: "employeeNumber",
                header: "Табельный номер",
                cell: (row: WmsEmployee) => (
                  <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-xs font-bold text-indigo-700 border border-indigo-100">
                    {row.employeeNumber}
                  </span>
                )
              },
              {
                key: "position",
                header: "Должность",
                cell: (row: WmsEmployee) => (
                  <span className="text-xs text-slate-600">{row.position || "—"}</span>
                )
              },
              {
                key: "department",
                header: "Цех / Подразделение",
                cell: (row: WmsEmployee) => (
                  <span className="text-xs text-slate-600">{row.department || "—"}</span>
                )
              },
              {
                key: "actions",
                header: "Действие",
                cell: (row: WmsEmployee) => (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onIssueItemClick(row.id);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                  >
                    <Plus size={12} /> Выписать ТМЦ
                  </button>
                )
              }
            ]}
            data={filteredEmployees}
            keyExtractor={(row) => row.id}
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </Modal>
  );
}
