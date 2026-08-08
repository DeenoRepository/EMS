"use client";

import { useState, useEffect } from "react";
import ShellLayout from "@/components/layout/shell-layout";
import {
  UserCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Box,
  CheckCircle2,
  AlertTriangle,
  Archive,
  QrCode
} from "lucide-react";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Modal,
  ModalHeader
} from "@/components/ui";
import { BarcodeLabelModal } from "@/components/wms/barcode-label-modal";

interface WmsPersonalCard {
  id: string;
  itemSku: string;
  itemName: string;
  employeeName: string;
  employeePosition: string | null;
  department: string | null;
  issuedQuantity: number;
  issuedAt: string;
  returnedAt: string | null;
  returnCondition: string | null;
  notes: string | null;
  item?: {
    cell: string;
    category: string;
  };
}

interface WmsItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  warehouse: string;
}

export default function WmsPersonalCardsPage() {
  const [cards, setCards] = useState<WmsPersonalCard[]>([]);
  const [items, setItems] = useState<WmsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<WmsPersonalCard | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Label Printing state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printItemData, setPrintItemData] = useState<{ sku: string; name: string; location?: string; category?: string } | null>(null);

  const [issueFormData, setIssueFormData] = useState({
    itemId: "",
    employeeName: "",
    employeePosition: "Инженер-механик",
    department: "Цех №1",
    quantity: 1,
    notes: "Выдача спецодежды / инструмента под расписку",
  });

  const [returnFormData, setReturnFormData] = useState({
    returnCondition: "GOOD",
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/modules/wms/personal-cards").then((res) => (res.ok ? res.json() : { cards: [] })),
      fetch("/api/modules/wms/items").then((res) => (res.ok ? res.json() : { items: [] }))
    ])
      .then(([cardsData, itemsData]) => {
        setCards(cardsData.cards || []);
        setItems(itemsData.items || []);
        if (itemsData.items?.length > 0) {
          setIssueFormData((prev) => ({ ...prev, itemId: itemsData.items[0].id }));
        }
      })
      .catch((err) => console.error("Failed to load personal cards:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/personal-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(issueFormData)
      });
      if (res.ok) {
        setShowIssueModal(false);
        setIssueFormData({
          itemId: items[0]?.id || "",
          employeeName: "",
          employeePosition: "Инженер-механик",
          department: "Цех №1",
          quantity: 1,
          notes: "Выдача спецодежды / инструмента под расписку",
        });
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка выдачи ТМЦ в личную карточку");
      }
    } catch (err) {
      console.error("Issue card error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/modules/wms/personal-cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: selectedCard.id,
          returnCondition: returnFormData.returnCondition
        })
      });
      if (res.ok) {
        setShowReturnModal(false);
        setSelectedCard(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка оформления возврата");
      }
    } catch (err) {
      console.error("Return submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const openLabelPrinter = (card: WmsPersonalCard) => {
    setPrintItemData({
      sku: card.itemSku,
      name: card.itemName,
      location: card.item?.cell || "А-01-1",
      category: "Личная карточка"
    });
    setPrintModalOpen(true);
  };

  return (
    <ShellLayout>
      <main className="w-full px-5 py-6 md:px-8 space-y-6">
        <PageHeader
          title="Личные карточки учетa СИЗ & Инструментов"
          description="Персональный учет выдачи спецодежды, средств индивидуальной защиты и инструментов сотрудникам"
          breadcrumbs={[
            { title: "Главная", href: "/" },
            { title: "WMS Складской учет", href: "/modules/wms" },
            { title: "Личные карточки СИЗ" },
          ]}
          actions={
            <>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Обновить
              </button>
              <button
                onClick={() => setShowIssueModal(true)}
                className="flex items-center gap-2 rounded-lg bg-[#2f74df] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#2565c8]"
              >
                <Plus size={14} /> Выдать СИЗ / Инструмент
              </button>
            </>
          }
        />

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <DataTable
            keyExtractor={(row) => row.id}
            data={cards}
            columns={[
              {
                key: "employeeName",
                header: "Сотрудник / Подразделение",
                cell: (row) => (
                  <div>
                    <span className="block text-[11px] font-bold text-[#17243a]">{row.employeeName}</span>
                    <span className="block text-[10px] text-slate-400">{row.employeePosition} ({row.department || "Цех"})</span>
                  </div>
                ),
              },
              {
                key: "itemSku",
                header: "Выданное имущество / Артикул",
                cell: (row) => (
                  <div className="font-mono">
                    <span className="block text-[11px] font-bold text-[#3473d4]">{row.itemName}</span>
                    <span className="block text-[10px] text-slate-400">SKU: {row.itemSku}</span>
                  </div>
                ),
              },
              {
                key: "issuedQuantity",
                header: "Выдано ед.",
                cell: (row) => <span className="text-[11px] font-bold text-slate-800">{row.issuedQuantity} ед.</span>,
              },
              {
                key: "issuedAt",
                header: "Дата выдачи",
                cell: (row) => <span className="text-[11px] text-slate-500">{new Date(row.issuedAt).toLocaleDateString("ru-RU")}</span>,
              },
              {
                key: "returnedAt",
                header: "Статус возврата",
                cell: (row) => {
                  if (row.returnedAt) {
                    if (row.returnCondition === "GOOD") return <StatusBadge status="ACTIVE" label="Возвращено (Исправно)" />;
                    if (row.returnCondition === "REPAIR") return <StatusBadge status="DRAFT" label="На ремонте" />;
                    return <StatusBadge status="DECOMMISSIONED" label="Списано в утиль" />;
                  }
                  return <StatusBadge status="INACTIVE" label="На руках у сотрудника" />;
                },
              },
              {
                key: "actions",
                header: "Действия",
                className: "text-right",
                cell: (row) => (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openLabelPrinter(row)}
                      title="Печать этикетки / QR-кода"
                      className="rounded bg-slate-100 p-1 text-slate-600 hover:bg-slate-200"
                    >
                      <QrCode size={13} />
                    </button>

                    {!row.returnedAt && (
                      <button
                        onClick={() => {
                          setSelectedCard(row);
                          setShowReturnModal(true);
                        }}
                        className="flex items-center gap-1 rounded bg-[#2f74df] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#2565c8]"
                      >
                        <RotateCcw size={11} /> Оформить возврат
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* Modal: Issue Item to Personal Card */}
        <Modal open={showIssueModal} onClose={() => setShowIssueModal(false)} size="lg">
          <ModalHeader
            icon={<UserCheck size={16} />}
            title="Выдача ТМЦ / СИЗ в личную карточку"
            subtitle="Укажите сотрудника и позицию ТМЦ"
            onClose={() => setShowIssueModal(false)}
          />
          <form onSubmit={handleIssueSubmit} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">ФИО Сотрудника *</label>
              <input
                required
                value={issueFormData.employeeName}
                onChange={(e) => setIssueFormData({ ...issueFormData, employeeName: e.target.value })}
                placeholder="Петров Алексей Сергеевич"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Должность</label>
                <input
                  value={issueFormData.employeePosition}
                  onChange={(e) => setIssueFormData({ ...issueFormData, employeePosition: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Цех / Подразделение</label>
                <input
                  value={issueFormData.department}
                  onChange={(e) => setIssueFormData({ ...issueFormData, department: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Выберите позицию ТМЦ / СИЗ *</label>
                <select
                  required
                  value={issueFormData.itemId}
                  onChange={(e) => setIssueFormData({ ...issueFormData, itemId: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (SKU: {i.sku}) — Склад: {i.warehouse} (Остаток: {i.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Количество ед. *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={issueFormData.quantity}
                  onChange={(e) => setIssueFormData({ ...issueFormData, quantity: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
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
                {submitting ? "Выдача..." : "Оформить выдачу"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Return Asset */}
        <Modal open={showReturnModal} onClose={() => setShowReturnModal(false)} size="md">
          <ModalHeader
            icon={<RotateCcw size={16} />}
            title="Оформление возврата имущества"
            subtitle={selectedCard ? `${selectedCard.itemName} от ${selectedCard.employeeName}` : ""}
            onClose={() => setShowReturnModal(false)}
          />
          <form onSubmit={handleReturnSubmit} className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Техническое состояние имущества при возврате *</label>
              <select
                value={returnFormData.returnCondition}
                onChange={(e) => setReturnFormData({ returnCondition: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="GOOD">Исправно — вернуть остаток на склад</option>
                <option value="REPAIR">Требует ремонта — направить в ТОиР</option>
                <option value="SCRAPPED">Списано в утиль / Непригодно</option>
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
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
                className="rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8] disabled:opacity-50"
              >
                {submitting ? "Сохранение..." : "Подтвердить возврат"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Barcode Label Modal Printer */}
        {printItemData && (
          <BarcodeLabelModal
            open={printModalOpen}
            onClose={() => setPrintModalOpen(false)}
            title="Печать этикетки СИЗ / Имущества"
            sku={printItemData.sku}
            name={printItemData.name}
            location={printItemData.location}
            category={printItemData.category}
          />
        )}
      </main>
    </ShellLayout>
  );
}
