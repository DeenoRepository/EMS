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
import {
  PersonalCardModal,
  ReturnPersonalItemModal,
  EmployeeDirectoryModal,
  AddEmployeeModal
} from "@/components/wms/modals";


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

        {/* MODAL 1: ISSUE ITEM TO PERSONAL CARD */}
        <PersonalCardModal
          isOpen={showIssueModal}
          onClose={() => setShowIssueModal(false)}
          onSuccess={fetchData}
          items={items as any}
          employees={employees as any}
        />

        {/* MODAL 2: EMPLOYEE DIRECTORY ROSTER */}
        <EmployeeDirectoryModal
          isOpen={showDirectoryModal}
          onClose={() => setShowDirectoryModal(false)}
          employees={employees as any}
          onAddEmployeeClick={() => setShowAddEmployeeModal(true)}
          onIssueItemClick={(empId) => {
            handleSelectEmployee(empId);
            setShowIssueModal(true);
          }}
        />

        {/* MODAL 3: ADD NEW EMPLOYEE TO ROSTER */}
        <AddEmployeeModal
          isOpen={showAddEmployeeModal}
          onClose={() => setShowAddEmployeeModal(false)}
          onSuccess={fetchData}
        />

        {/* MODAL 4: RETURN ITEM FROM PERSONAL CARD */}
        <ReturnPersonalItemModal
          isOpen={showReturnModal}
          onClose={() => setShowReturnModal(false)}
          onSuccess={fetchData}
          card={selectedCard as any}
        />


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
