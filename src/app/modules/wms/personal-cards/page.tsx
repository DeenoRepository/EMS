"use client";

import { useState, useEffect, useMemo } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  UserCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  QrCode,
  Search,
  CheckCircle,
  XCircle,
  FileText,
  Users,
  UserPlus,
  Building2
} from "lucide-react";
import {
  PageHeader,
  KpiGrid,
  DataTable,
  StatusBadge,
  Modal,
  ModalHeader,
  FilterToolbar
} from "@/components/ui";
import { BarcodeLabelModal } from "@/components/wms/barcode-label-modal";

interface WmsPersonalCard {
  id: string;
  itemSku: string;
  itemName: string;
  employeeName: string;
  employeePosition: string | null;
  employeeNumber: string | null;
  department: string | null;
  issuedQuantity: number;
  issuedAt: string;
  returnedAt: string | null;
  returnCondition: string | null;
  notes: string | null;
}

interface WmsEmployeeOption {
  id: string;
  name: string;
  employeeNumber: string;
  position: string | null;
  department: string | null;
  warehouse: string | null;
}

interface WmsItemOption {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  warehouse: string;
}

export default function WmsPersonalCardsPage() {
  const [cards, setCards] = useState<WmsPersonalCard[]>([]);
  const [employees, setEmployees] = useState<WmsEmployeeOption[]>([]);
  const [items, setItems] = useState<WmsItemOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals state
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<WmsPersonalCard | null>(null);

  // Label Printing state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printCard, setPrintCard] = useState<WmsPersonalCard | null>(null);

  // Issue Form Data
  const [issueFormData, setIssueFormData] = useState({
    selectedEmployeeId: "",
    employeeName: "",
    employeePosition: "Инженер-механик",
    employeeNumber: "Т-0482",
    department: "Цех №1",
    itemId: "",
    quantity: 1,
    notes: "Выдача по нормам СИЗ",
    saveToRoster: true
  });

  // Return Form Data
  const [returnFormData, setReturnFormData] = useState({
    returnCondition: "GOOD"
  });

  // New Employee Directory Form Data
  const [newEmployeeData, setNewEmployeeData] = useState({
    name: "",
    employeeNumber: "",
    position: "Слесарь-ремонтник",
    department: "Цех №1",
    warehouse: "Главный склад"
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/modules/wms/personal-cards").then((r) => (r.ok ? r.json() : { cards: [] })),
      fetch("/api/modules/wms/employees").then((r) => (r.ok ? r.json() : { employees: [] })),
      fetch("/api/modules/wms/items").then((r) => (r.ok ? r.json() : { items: [] }))
    ])
      .then(([cardsData, empData, itemsData]) => {
        setCards(cardsData.cards || []);
        const loadedEmps = empData.employees || [];
        setEmployees(loadedEmps);
        const loadedItems = itemsData.items || [];
        setItems(loadedItems);

        if (loadedItems.length > 0) {
          setIssueFormData((prev) => ({ ...prev, itemId: loadedItems[0].id }));
        }
      })
      .catch((err) => console.error("Personal cards query error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const departments = useMemo(() => {
    return Array.from(new Set(cards.map((c) => c.department).filter(Boolean))) as string[];
  }, [cards]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (departmentFilter !== "ALL" && card.department !== departmentFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          card.employeeName.toLowerCase().includes(q) ||
          (card.employeeNumber && card.employeeNumber.toLowerCase().includes(q)) ||
          card.itemName.toLowerCase().includes(q) ||
          card.itemSku.toLowerCase().includes(q) ||
          (card.department && card.department.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [cards, departmentFilter, searchQuery]);

  const kpiStats = useMemo(() => {
    const totalIssued = cards.length;
    const activeIssued = cards.filter((c) => !c.returnedAt).length;
    const returnedCount = cards.filter((c) => c.returnedAt).length;
    const totalRoster = employees.length;
    return { totalIssued, activeIssued, returnedCount, totalRoster };
  }, [cards, employees]);

  // Select employee from roster autocomplete
  const handleSelectEmployee = (empId: string) => {
    if (!empId) {
      setIssueFormData((prev) => ({ ...prev, selectedEmployeeId: "" }));
      return;
    }
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setIssueFormData((prev) => ({
        ...prev,
        selectedEmployeeId: emp.id,
        employeeName: emp.name,
        employeeNumber: emp.employeeNumber,
        employeePosition: emp.position || "Сотрудник",
        department: emp.department || "Цех №1"
      }));
    }
  };

  // Register new employee to directory roster
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmployeeData)
      });
      if (res.ok) {
        setShowAddEmployeeModal(false);
        setNewEmployeeData({
          name: "",
          employeeNumber: "",
          position: "Слесарь-ремонтник",
          department: "Цех №1",
          warehouse: "Главный склад"
        });
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка сохранения сотрудника в справочник");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Issue Item to Personal Card
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. If saveToRoster selected, also register/update employee in roster
      if (issueFormData.saveToRoster && issueFormData.employeeName && issueFormData.employeeNumber) {
        await fetch("/api/modules/wms/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: issueFormData.employeeName,
            employeeNumber: issueFormData.employeeNumber,
            position: issueFormData.employeePosition,
            department: issueFormData.department
          })
        });
      }

      // 2. Create Personal Card issuance
      const res = await fetch("/api/modules/wms/personal-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(issueFormData)
      });

      if (res.ok) {
        setShowIssueModal(false);
        setIssueFormData({
          selectedEmployeeId: "",
          employeeName: "",
          employeePosition: "Инженер-механик",
          employeeNumber: `Т-${Math.floor(1000 + Math.random() * 9000)}`,
          department: "Цех №1",
          itemId: items[0]?.id || "",
          quantity: 1,
          notes: "Выдача по нормам СИЗ",
          saveToRoster: true
        });
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Ошибка выдачи ТМЦ на карточку");
      }
    } catch (err) {
      console.error("Issue card error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Return Item from Personal Card
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/modules/wms/personal-cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedCard.id,
          returnCondition: returnFormData.returnCondition
        })
      });
      if (res.ok) {
        setShowReturnModal(false);
        setSelectedCard(null);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Ошибка возврата ТМЦ");
      }
    } catch (err) {
      console.error("Return submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Личные карточки учета СИЗ и инструмента"
          description="Реестр сотрудников склада, оформление персональных карточек выдачи ТМЦ и учет возвратов."
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет", href: "/modules/wms" },
            { title: "Личные карточки" }
          ]}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
              </button>
              <button
                onClick={() => setShowDirectoryModal(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Users size={14} className="text-slate-500" /> Справочник сотрудников ({employees.length})
              </button>
              <button
                onClick={() => setShowIssueModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Plus size={14} /> Выдать сотруднику
              </button>
            </div>
          }
        />

        <KpiGrid
          items={[
            {
              label: "Сотрудников в реестре склада",
              value: kpiStats.totalRoster,
              sub: "Сформированный список кладовщика",
              subColor: "slate",
              icon: <Users size={18} />,
              iconColor: "blue"
            },
            {
              label: "Всего заведенных карточек",
              value: kpiStats.totalIssued,
              sub: "Записей выдачи в системе",
              subColor: "slate",
              icon: <UserCheck size={18} />,
              iconColor: "indigo"
            },
            {
              label: "На руках у сотрудников",
              value: kpiStats.activeIssued,
              sub: "Активные СИЗ / Имущество",
              subColor: "amber",
              icon: <FileText size={18} />,
              iconColor: "amber"
            },
            {
              label: "Возвращено на склад",
              value: kpiStats.returnedCount,
              sub: "Возвращенных позиций",
              subColor: "emerald",
              icon: <RotateCcw size={18} />,
              iconColor: "emerald"
            }
          ]}
        />

        <div className="space-y-4">
          <FilterToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Поиск по ФИО, табельному номеру, наименованию ТМЦ, артикулу, цеху..."
            filters={[
              {
                key: "department",
                label: "Подразделение",
                value: departmentFilter,
                options: [
                  { label: "Все цеха и подразделения", value: "ALL" },
                  ...departments.map((d) => ({ label: d, value: d }))
                ],
                onChange: setDepartmentFilter
              }
            ]}
          />

          <DataTable
            columns={[
              {
                key: "employee",
                header: "Сотрудник / Табельный №",
                cell: (row: WmsPersonalCard) => (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-xs">{row.employeeName}</span>
                      {row.employeeNumber && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.2 font-mono text-[10px] font-bold text-indigo-700 border border-indigo-100">
                          Таб. №{row.employeeNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {row.employeePosition || "Сотрудник"} {row.department ? `(${row.department})` : ""}
                    </div>
                  </div>
                )
              },
              {
                key: "item",
                header: "Выданный ТМЦ / СИЗ",
                cell: (row: WmsPersonalCard) => (
                  <div>
                    <div className="font-semibold text-slate-800 text-xs">{row.itemName}</div>
                    <div className="font-mono text-[10px] text-blue-600">SKU: {row.itemSku}</div>
                  </div>
                )
              },
              {
                key: "quantity",
                header: "Количество",
                cell: (row: WmsPersonalCard) => (
                  <span className="font-bold text-xs text-slate-900">{row.issuedQuantity} шт</span>
                )
              },
              {
                key: "issuedAt",
                header: "Дата выдачи",
                cell: (row: WmsPersonalCard) => (
                  <span className="text-xs font-mono text-slate-600">
                    {new Date(row.issuedAt).toLocaleDateString()}
                  </span>
                )
              },
              {
                key: "status",
                header: "Статус карточки",
                cell: (row: WmsPersonalCard) => (
                  <StatusBadge
                    status={row.returnedAt ? "APPROVED" : "PENDING"}
                    label={row.returnedAt ? `Возвращено (${row.returnCondition || "Исправно"})` : "На руках"}
                  />
                )
              },
              {
                key: "actions",
                header: "Действия",
                cell: (row: WmsPersonalCard) => (
                  <div className="flex items-center gap-1.5">
                    {!row.returnedAt && (
                      <button
                        onClick={() => {
                          setSelectedCard(row);
                          setShowReturnModal(true);
                        }}
                        className="flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        <RotateCcw size={12} /> Возврат
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setPrintCard(row);
                        setPrintModalOpen(true);
                      }}
                      title="Печать этикетки СИЗ"
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                    >
                      <QrCode size={15} />
                    </button>
                  </div>
                )
              }
            ]}
            data={filteredCards}
            keyExtractor={(row) => row.id}
          />
        </div>

        {/* MODAL 1: ISSUE ITEM TO EMPLOYEE */}
        <Modal open={showIssueModal} onClose={() => setShowIssueModal(false)} size="lg">
          <ModalHeader
            icon={<UserCheck size={16} />}
            title="Выдача ТМЦ / СИЗ на личную карточку"
            subtitle="Выбор сотрудника из реестра кладовщика или ввод нового"
            onClose={() => setShowIssueModal(false)}
          />
          <form onSubmit={handleIssueSubmit} className="p-6 space-y-4">
            {/* Quick Autocomplete Select from Roster */}
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
              <label className="block text-xs font-semibold text-blue-900 mb-1">
                Выберите сотрудника из сформированного Справочника:
              </label>
              <select
                value={issueFormData.selectedEmployeeId}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- Новое материально ответственное лицо / Ручной ввод --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} (Таб. №{emp.employeeNumber}) — {emp.position} ({emp.department})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ФИО Сотрудника *</label>
                <input
                  required
                  type="text"
                  value={issueFormData.employeeName}
                  onChange={(e) => setIssueFormData({ ...issueFormData, employeeName: e.target.value })}
                  placeholder="Иванов Сергей Викторович"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Табельный номер *</label>
                <input
                  required
                  type="text"
                  value={issueFormData.employeeNumber}
                  onChange={(e) => setIssueFormData({ ...issueFormData, employeeNumber: e.target.value })}
                  placeholder="Т-0482"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Должность</label>
                <input
                  type="text"
                  value={issueFormData.employeePosition}
                  onChange={(e) => setIssueFormData({ ...issueFormData, employeePosition: e.target.value })}
                  placeholder="Инженер-механик"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Подразделение / Цех</label>
                <input
                  type="text"
                  value={issueFormData.department}
                  onChange={(e) => setIssueFormData({ ...issueFormData, department: e.target.value })}
                  placeholder="Цех №1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Выдаваемый ТМЦ / СИЗ *</label>
                <select
                  required
                  value={issueFormData.itemId}
                  onChange={(e) => setIssueFormData({ ...issueFormData, itemId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku}) - Склад: {i.warehouse} (Доступно: {i.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Количество *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={issueFormData.quantity}
                  onChange={(e) => setIssueFormData({ ...issueFormData, quantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Примечание / Основание</label>
              <input
                type="text"
                value={issueFormData.notes}
                onChange={(e) => setIssueFormData({ ...issueFormData, notes: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="saveToRoster"
                checked={issueFormData.saveToRoster}
                onChange={(e) => setIssueFormData({ ...issueFormData, saveToRoster: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="saveToRoster" className="text-xs font-medium text-slate-700 cursor-pointer">
                Сохранить/Обновить данного сотрудника в Справочнике склада кладовщика
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] disabled:opacity-50"
              >
                {submitting ? "Оформление..." : "Оформить выдачу"}
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL 2: EMPLOYEE DIRECTORY ROSTER */}
        <Modal open={showDirectoryModal} onClose={() => setShowDirectoryModal(false)} size="lg">
          <ModalHeader
            icon={<Users size={16} />}
            title="Справочник сотрудников склада кладовщика"
            subtitle="Перечень материально ответственных лиц, на которых заводятся карточки ТМЦ"
            onClose={() => setShowDirectoryModal(false)}
          />
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Всего заведено сотрудников: <strong>{employees.length}</strong>
              </span>
              <button
                onClick={() => setShowAddEmployeeModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <UserPlus size={13} /> Добавить сотрудника в реестр
              </button>
            </div>

            <DataTable
              columns={[
                {
                  key: "name",
                  header: "ФИО Сотрудника",
                  cell: (row: WmsEmployeeOption) => (
                    <span className="font-semibold text-slate-900 text-xs">{row.name}</span>
                  )
                },
                {
                  key: "employeeNumber",
                  header: "Табельный номер",
                  cell: (row: WmsEmployeeOption) => (
                    <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-xs font-bold text-indigo-700 border border-indigo-100">
                      {row.employeeNumber}
                    </span>
                  )
                },
                {
                  key: "position",
                  header: "Должность",
                  cell: (row: WmsEmployeeOption) => (
                    <span className="text-xs text-slate-600">{row.position || "—"}</span>
                  )
                },
                {
                  key: "department",
                  header: "Цех / Подразделение",
                  cell: (row: WmsEmployeeOption) => (
                    <span className="text-xs text-slate-600">{row.department || "—"}</span>
                  )
                },
                {
                  key: "actions",
                  header: "Действие",
                  cell: (row: WmsEmployeeOption) => (
                    <button
                      onClick={() => {
                        handleSelectEmployee(row.id);
                        setShowDirectoryModal(false);
                        setShowIssueModal(true);
                      }}
                      className="flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <Plus size={12} /> Выписать ТМЦ
                    </button>
                  )
                }
              ]}
              data={employees}
              keyExtractor={(row) => row.id}
            />
          </div>
        </Modal>

        {/* MODAL 3: ADD NEW EMPLOYEE TO ROSTER */}
        <Modal open={showAddEmployeeModal} onClose={() => setShowAddEmployeeModal(false)} size="md">
          <ModalHeader
            icon={<UserPlus size={16} />}
            title="Новый сотрудник в Справочник склада"
            subtitle="Заведение нового материально ответственного лица"
            onClose={() => setShowAddEmployeeModal(false)}
          />
          <form onSubmit={handleAddEmployeeSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ФИО Сотрудника *</label>
              <input
                required
                type="text"
                value={newEmployeeData.name}
                onChange={(e) => setNewEmployeeData({ ...newEmployeeData, name: e.target.value })}
                placeholder="Петров Алексей Сергеевич"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Табельный номер *</label>
              <input
                required
                type="text"
                value={newEmployeeData.employeeNumber}
                onChange={(e) => setNewEmployeeData({ ...newEmployeeData, employeeNumber: e.target.value })}
                placeholder="Т-0899"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Должность</label>
                <input
                  type="text"
                  value={newEmployeeData.position}
                  onChange={(e) => setNewEmployeeData({ ...newEmployeeData, position: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Цех / Подразделение</label>
                <input
                  type="text"
                  value={newEmployeeData.department}
                  onChange={(e) => setNewEmployeeData({ ...newEmployeeData, department: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAddEmployeeModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Сохранение..." : "Сохранить в Справочник"}
              </button>
            </div>
          </form>
        </Modal>

        {/* MODAL 4: RETURN ITEM FROM PERSONAL CARD */}
        <Modal open={showReturnModal} onClose={() => setShowReturnModal(false)} size="md">
          <ModalHeader
            icon={<RotateCcw size={16} />}
            title="Оформление возврата имущества"
            subtitle={selectedCard ? `${selectedCard.itemName} от ${selectedCard.employeeName} (Таб. №${selectedCard.employeeNumber || "Б/Н"})` : ""}
            onClose={() => setShowReturnModal(false)}
          />
          <form onSubmit={handleReturnSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Состояние при возврате *</label>
              <select
                value={returnFormData.returnCondition}
                onChange={(e) => setReturnFormData({ returnCondition: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
              >
                <option value="GOOD">Исправно — вернуть на склад</option>
                <option value="REPAIR">Требует ремонта — передать в ТОИР</option>
                <option value="SCRAPPED">Списано в утиль / Непригодно</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? "Сохранение..." : "Подтвердить возврат"}
              </button>
            </div>
          </form>
        </Modal>

        {/* BARCODE PRINT MODAL */}
        {printCard && (
          <BarcodeLabelModal
            open={printModalOpen}
            onClose={() => {
              setPrintModalOpen(false);
              setPrintCard(null);
            }}
            title="Этикетка СИЗ / Имущества"
            sku={printCard.itemSku}
            name={printCard.itemName}
            location={`Таб. №${printCard.employeeNumber || "Б/Н"}: ${printCard.employeeName}`}
            category={printCard.department || "СИЗ"}
          />
        )}
      </main>
    </ShellLayout>
  );
}
