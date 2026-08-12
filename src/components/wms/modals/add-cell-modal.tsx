"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalHeader } from "@/components/ui";
import { MapPin, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Warehouse } from "@/types/wms";
import { getZonesForWarehouse, getCellsForZone, checkDirtyFormClose } from "./wms-modal-utils";

interface AddCellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  warehouses: Warehouse[];
  initialWarehouseId?: string;
}

export function AddCellModal({
  isOpen,
  onClose,
  onSuccess,
  warehouses = [],
  initialWarehouseId
}: AddCellModalProps) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [zone, setZone] = useState("");
  const [cellCode, setCellCode] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState<number>(100);
  
  const [isDirty, setIsDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsDirty(false);
      setErrorMessage(null);
      const whId = initialWarehouseId || warehouses[0]?.id || "";
      setSelectedWarehouseId(whId);

      const foundWh = warehouses.find((w) => w.id === whId || w.name === whId);
      const availableZones = getZonesForWarehouse(foundWh?.name || "", warehouses);
      const initialZone = availableZones[0] || "Зона А (Основная)";
      setZone(initialZone);

      const availableCells = getCellsForZone(initialZone);
      setCellCode(availableCells[0] || "Яч-01");
      setDescription("Стандартная стеллажная ячейка хранения");
    }
  }, [isOpen, initialWarehouseId, warehouses]);

  const handleWarehouseChange = (whId: string) => {
    setIsDirty(true);
    setSelectedWarehouseId(whId);
    const foundWh = warehouses.find((w) => w.id === whId || w.name === whId);
    const availableZones = getZonesForWarehouse(foundWh?.name || "", warehouses);
    const nextZone = availableZones[0] || "Зона А";
    setZone(nextZone);
    const availableCells = getCellsForZone(nextZone);
    setCellCode(availableCells[0] || "Яч-01");
  };

  const handleZoneChange = (zoneName: string) => {
    setIsDirty(true);
    setZone(zoneName);
    const availableCells = getCellsForZone(zoneName);
    setCellCode(availableCells[0] || "Яч-01");
  };

  const handleSafeClose = () => {
    checkDirtyFormClose(isDirty, onClose);
  };

  if (!isOpen) return null;

  const foundWh = warehouses.find((w) => w.id === selectedWarehouseId || w.name === selectedWarehouseId);
  const availableZones = getZonesForWarehouse(foundWh?.name || "", warehouses);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedWarehouseId || !cellCode.trim()) {
      setErrorMessage("Укажите целевой склад и уникальный код ячейки");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/modules/wms/warehouses/${selectedWarehouseId}/cells`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cellCode.trim(),
          zone: zone,
          description: description.trim(),
          capacity: capacity
        })
      });

      if (res.ok) {
        setIsDirty(false);
        onSuccess();
        onClose();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || "Ошибка создания ячейки топологии");
      }
    } catch (err) {
      console.error("Failed to add topology cell:", err);
      setErrorMessage("Ошибка сети при создании ячейки");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={handleSafeClose} size="md">
      <ModalHeader
        icon={<MapPin size={16} className="text-blue-600" />}
        title="Новая ячейка адресного хранения"
        subtitle="Присвоение уникального топологического адреса ячейки"
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
          <label className="block text-xs font-semibold text-slate-700 mb-1">Склад *</label>
          <select
            value={selectedWarehouseId}
            onChange={(e) => handleWarehouseChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Зона топологии *</label>
            <select
              value={zone}
              onChange={(e) => handleZoneChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {availableZones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Код ячейки *</label>
            <input
              required
              type="text"
              value={cellCode}
              onChange={(e) => {
                setIsDirty(true);
                setCellCode(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-blue-700 focus:ring-2 focus:ring-blue-500"
              placeholder="С-01-А3"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Описание / Стеллаж</label>
          <input
            type="text"
            value={description}
            onChange={(e) => {
              setIsDirty(true);
              setDescription(e.target.value);
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
            placeholder="Стеллаж крупногабарита №1"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Вместимость / Капацитет (шт)</label>
          <input
            type="number"
            min="1"
            value={capacity}
            onChange={(e) => {
              setIsDirty(true);
              setCapacity(parseInt(e.target.value) || 1);
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
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
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs disabled:opacity-50 transition"
          >
            <Plus size={15} />
            <span>{submitting ? "Добавление..." : "Добавить ячейку"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
