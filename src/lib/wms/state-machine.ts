import { WmsTransferStatus, WmsRequisitionStatus } from "@prisma/client";

/**
 * Конечный автомат межскладского перемещения (SEC-04).
 * Разрешены только следующие переходы:
 * - PENDING -> APPROVED
 * - PENDING -> REJECTED
 * Все остальные переходы (включая повторные) запрещены и должны возвращать HTTP 409 Conflict.
 */
export function isValidTransferTransition(
  currentStatus: WmsTransferStatus,
  targetStatus: WmsTransferStatus
): boolean {
  if (currentStatus !== WmsTransferStatus.PENDING) {
    return false;
  }
  return (
    targetStatus === WmsTransferStatus.APPROVED ||
    targetStatus === WmsTransferStatus.REJECTED
  );
}

/**
 * Конечный автомат личной карточки СИЗ/инструментов (SEC-05).
 * Возврат возможен только в том случае, если деталь еще не была возвращена (returnedAt === null).
 * Повторный возврат запрещен и должен возвращать HTTP 409 Conflict.
 */
export function canReturnPersonalCard(returnedAt: Date | null): boolean {
  return returnedAt === null;
}

/**
 * Конечный автомат заявок на ТМЦ (Requisitions).
 */
export function isValidRequisitionTransition(
  currentStatus: WmsRequisitionStatus,
  targetStatus: WmsRequisitionStatus
): boolean {
  const allowedTransitions: Record<WmsRequisitionStatus, WmsRequisitionStatus[]> = {
    DRAFT: [WmsRequisitionStatus.REQUESTED, WmsRequisitionStatus.CANCELLED],
    REQUESTED: [
      WmsRequisitionStatus.APPROVED,
      WmsRequisitionStatus.REJECTED,
      WmsRequisitionStatus.CANCELLED,
    ],
    APPROVED: [WmsRequisitionStatus.IN_TRANSIT, WmsRequisitionStatus.COMPLETED],
    IN_TRANSIT: [WmsRequisitionStatus.COMPLETED],
    COMPLETED: [],
    REJECTED: [],
    CANCELLED: [],
  };

  return allowedTransitions[currentStatus]?.includes(targetStatus) ?? false;
}
