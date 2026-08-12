"use client";

import React, { useState } from "react";
import { Modal, ModalHeader } from "@/components/ui";
import { Printer, QrCode, Barcode, Check, Copy } from "lucide-react";

interface BarcodeLabelModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sku: string;
  name: string;
  location?: string;
  category?: string;
}

type LabelFormat = "58x40" | "40x30" | "70x50";
type CodeType = "BARCODE" | "QR";

export function BarcodeLabelModal({
  open,
  onClose,
  title,
  sku,
  name,
  location,
  category
}: BarcodeLabelModalProps) {
  const [labelFormat, setLabelFormat] = useState<LabelFormat>("58x40");
  const [codeType, setCodeType] = useState<CodeType>("BARCODE");
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopySku = () => {
    navigator.clipboard.writeText(sku);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader
        icon={<QrCode size={16} className="text-blue-600" />}
        title={title}
        subtitle="Формирование печатной этикетки для термопринтера WMS"
        onClose={onClose}
      />
      
      <div className="p-6 space-y-6">
        {/* Controls toolbar */}
        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Размер этикетки</label>
            <select
              value={labelFormat}
              onChange={(e) => setLabelFormat(e.target.value as LabelFormat)}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs bg-white font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="58x40">Термо 58 × 40 мм (Стандарт WMS)</option>
              <option value="40x30">Компакт 40 × 30 мм</option>
              <option value="70x50">Крупная 70 × 50 мм</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Тип кодирования</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCodeType("BARCODE")}
                className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold border transition ${
                  codeType === "BARCODE"
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Barcode size={14} /> Code128
              </button>
              <button
                type="button"
                onClick={() => setCodeType("QR")}
                className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold border transition ${
                  codeType === "QR"
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <QrCode size={14} /> QR-код
              </button>
            </div>
          </div>
        </div>

        {/* Printable Label SVG Box */}
        <div
          id="printable-label"
          className={`mx-auto rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 text-slate-800 shadow-md font-sans transition-all ${
            labelFormat === "40x30" ? "w-[200px]" : labelFormat === "70x50" ? "w-[280px]" : "w-[240px]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">EMS WMS</span>
            <span className="font-mono text-[9px] font-bold text-blue-600">{category || "ТМЦ"}</span>
          </div>

          <div className="my-2.5 text-center">
            <h4 className="text-xs font-extrabold leading-tight text-slate-900 line-clamp-2">{name}</h4>
            <div className="mt-1 flex items-center justify-center gap-1">
              <span className="font-mono text-[11px] font-black tracking-widest text-slate-800">{sku}</span>
              <button
                type="button"
                onClick={handleCopySku}
                className="text-slate-400 hover:text-blue-600 transition"
                title="Копировать SKU"
              >
                {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
              </button>
            </div>
          </div>

          {/* Code Graphics */}
          <div className="my-3 flex justify-center items-center">
            {codeType === "BARCODE" ? (
              <svg className="h-14 w-full">
                <rect x="0" y="0" width="100%" height="100%" fill="#ffffff" />
                <rect x="10" y="5" width="4" height="40" fill="#000000" />
                <rect x="16" y="5" width="2" height="40" fill="#000000" />
                <rect x="22" y="5" width="6" height="40" fill="#000000" />
                <rect x="32" y="5" width="2" height="40" fill="#000000" />
                <rect x="38" y="5" width="4" height="40" fill="#000000" />
                <rect x="46" y="5" width="6" height="40" fill="#000000" />
                <rect x="56" y="5" width="2" height="40" fill="#000000" />
                <rect x="62" y="5" width="8" height="40" fill="#000000" />
                <rect x="74" y="5" width="4" height="40" fill="#000000" />
                <rect x="82" y="5" width="2" height="40" fill="#000000" />
                <rect x="88" y="5" width="6" height="40" fill="#000000" />
                <rect x="98" y="5" width="4" height="40" fill="#000000" />
                <rect x="106" y="5" width="2" height="40" fill="#000000" />
                <rect x="112" y="5" width="6" height="40" fill="#000000" />
                <rect x="122" y="5" width="4" height="40" fill="#000000" />
              </svg>
            ) : (
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <QrCode size={56} className="text-slate-900" />
              </div>
            )}
          </div>

          {location && (
            <div className="mt-2 border-t border-slate-200 pt-1.5 text-center text-[10px] font-semibold text-slate-600">
              Ячейка: <span className="font-mono font-bold text-slate-900">{location}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition"
          >
            <Printer size={15} />
            <span>Печать этикетки</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
