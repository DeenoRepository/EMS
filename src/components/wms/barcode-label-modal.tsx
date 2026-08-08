"use client";

import React from "react";
import { Modal, ModalHeader } from "@/components/ui";
import { Printer, QrCode } from "lucide-react";

interface BarcodeLabelModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sku: string;
  name: string;
  location?: string;
  category?: string;
}

export function BarcodeLabelModal({
  open,
  onClose,
  title,
  sku,
  name,
  location,
  category
}: BarcodeLabelModalProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader
        icon={<QrCode size={16} />}
        title={title}
        subtitle="Печатная форма этикетки для термопринтера (58x40 мм)"
        onClose={onClose}
      />
      <div className="p-6 space-y-6">
        {/* SVG Label Container */}
        <div
          id="printable-label"
          className="mx-auto w-[240px] rounded-lg border-2 border-dashed border-slate-300 bg-white p-4 text-slate-800 shadow-sm font-sans"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">EMS WMS LABEL</span>
            <span className="font-mono text-[9px] font-bold text-blue-600">{category || "ТМЦ"}</span>
          </div>

          <div className="my-3 text-center">
            <h4 className="text-xs font-bold leading-tight text-slate-900">{name}</h4>
            <div className="mt-1 font-mono text-[11px] font-extrabold tracking-widest text-slate-700">
              {sku}
            </div>
          </div>

          {/* Simulated SVG Barcode / QR */}
          <div className="my-2 flex justify-center">
            <svg className="h-16 w-36">
              <rect x="0" y="0" width="100%" height="100%" fill="#ffffff" />
              {/* Simulated barcode lines */}
              <rect x="10" y="10" width="4" height="45" fill="#000000" />
              <rect x="16" y="10" width="2" height="45" fill="#000000" />
              <rect x="22" y="10" width="6" height="45" fill="#000000" />
              <rect x="32" y="10" width="2" height="45" fill="#000000" />
              <rect x="38" y="10" width="4" height="45" fill="#000000" />
              <rect x="46" y="10" width="6" height="45" fill="#000000" />
              <rect x="56" y="10" width="2" height="45" fill="#000000" />
              <rect x="62" y="10" width="8" height="45" fill="#000000" />
              <rect x="74" y="10" width="4" height="45" fill="#000000" />
              <rect x="82" y="10" width="2" height="45" fill="#000000" />
              <rect x="88" y="10" width="6" height="45" fill="#000000" />
              <rect x="98" y="10" width="4" height="45" fill="#000000" />
              <rect x="106" y="10" width="2" height="45" fill="#000000" />
              <rect x="112" y="10" width="6" height="45" fill="#000000" />
              <rect x="122" y="10" width="4" height="45" fill="#000000" />
            </svg>
          </div>

          {location && (
            <div className="mt-2 border-t border-slate-200 pt-2 text-center text-[10px] font-semibold text-slate-600">
              Ячейка: <span className="font-mono text-slate-900">{location}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2565c8]"
          >
            <Printer size={14} /> Печать этикетки
          </button>
        </div>
      </div>
    </Modal>
  );
}
