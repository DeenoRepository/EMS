"use client";

import * as React from "react";
import { FileText, Download } from "lucide-react";
import { Modal } from "./modal";
import { ModalHeader } from "./modal-header";
import { ModalFooter } from "./modal-footer";

export interface DocumentViewerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  docUrl: string;
  docType?: string;
  fileSize?: string;
}

export function DocumentViewerModal({
  open,
  onClose,
  title,
  docUrl,
  docType = "PDF",
  fileSize,
}: DocumentViewerModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="xl">
      <ModalHeader
        icon={<FileText size={16} />}
        title={title}
        subtitle={fileSize ? `${docType} • ${fileSize}` : docType}
        onClose={onClose}
      />
      <div className="flex-1 min-h-[450px] w-full bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center">
        {docUrl.endsWith(".pdf") || docUrl.includes("pdf") ? (
          <iframe src={docUrl} className="w-full h-full border-0 min-h-[450px]" title={title} />
        ) : (
          <div className="text-center space-y-3 p-6">
            <FileText size={48} className="mx-auto text-slate-400" />
            <p className="text-xs text-slate-500">Предпросмотр недоступен для данного типа файла</p>
            <a
              href={docUrl}
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#2565c8] transition"
            >
              <Download size={13} />
              Скачать файл
            </a>
          </div>
        )}
      </div>
      <ModalFooter onCancel={onClose} cancelLabel="Закрыть">
        <a
          href={docUrl}
          download
          className="flex items-center gap-1.5 rounded-lg bg-[#2f74df] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#2565c8] transition"
        >
          <Download size={13} />
          Скачать
        </a>
      </ModalFooter>
    </Modal>
  );
}
