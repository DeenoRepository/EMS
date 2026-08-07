"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./modal";
import { ModalHeader } from "./modal-header";
import { ModalFooter } from "./modal-footer";

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Подтверждение действия",
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger = true,
  loading = false,
}: ConfirmModalProps) {
  const [submitting, setSubmitting] = React.useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHeader
        icon={<AlertTriangle size={16} className={danger ? "text-rose-600" : "text-amber-600"} />}
        title={title}
        onClose={onClose}
      />
      <div className="py-2 text-xs text-slate-600 dark:text-slate-300">{message}</div>
      <ModalFooter
        onCancel={onClose}
        cancelLabel={cancelLabel}
        onSubmit={handleConfirm}
        submitLabel={confirmLabel}
        submitting={loading || submitting}
        submitVariant={danger ? "danger" : "primary"}
      />
    </Modal>
  );
}
