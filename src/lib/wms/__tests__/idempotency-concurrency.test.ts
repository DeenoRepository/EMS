import { describe, it, expect } from "vitest";
import {
  isValidTransferTransition,
  canReturnPersonalCard,
  isValidRequisitionTransition,
} from "../state-machine";
import { WmsTransferStatus, WmsRequisitionStatus } from "@prisma/client";

describe("SEC-04 & SEC-05: WMS State Machines & Idempotency Rules", () => {
  describe("Transfer State Machine (isValidTransferTransition / SEC-04)", () => {
    it("should allow transition from PENDING to APPROVED or REJECTED", () => {
      expect(
        isValidTransferTransition(WmsTransferStatus.PENDING, WmsTransferStatus.APPROVED)
      ).toBe(true);
      expect(
        isValidTransferTransition(WmsTransferStatus.PENDING, WmsTransferStatus.REJECTED)
      ).toBe(true);
    });

    it("should reject repeated or terminal status transitions (409 Conflict scenario)", () => {
      // Повторное подтверждение уже одобренного трансфера
      expect(
        isValidTransferTransition(WmsTransferStatus.APPROVED, WmsTransferStatus.APPROVED)
      ).toBe(false);

      // Попытка отклонить уже одобренный трансфер
      expect(
        isValidTransferTransition(WmsTransferStatus.APPROVED, WmsTransferStatus.REJECTED)
      ).toBe(false);

      // Повторная попытка подтердить отклоненный трансфер
      expect(
        isValidTransferTransition(WmsTransferStatus.REJECTED, WmsTransferStatus.APPROVED)
      ).toBe(false);
    });
  });

  describe("Personal Card Return Idempotency (canReturnPersonalCard / SEC-05)", () => {
    it("should allow returning personal card item if returnedAt is null", () => {
      expect(canReturnPersonalCard(null)).toBe(true);
    });

    it("should prevent double returning if returnedAt is set (409 Conflict scenario)", () => {
      expect(canReturnPersonalCard(new Date())).toBe(false);
    });
  });

  describe("Requisition State Machine (isValidRequisitionTransition)", () => {
    it("should allow valid sequential transitions", () => {
      expect(
        isValidRequisitionTransition(WmsRequisitionStatus.DRAFT, WmsRequisitionStatus.REQUESTED)
      ).toBe(true);
      expect(
        isValidRequisitionTransition(WmsRequisitionStatus.REQUESTED, WmsRequisitionStatus.APPROVED)
      ).toBe(true);
      expect(
        isValidRequisitionTransition(WmsRequisitionStatus.APPROVED, WmsRequisitionStatus.COMPLETED)
      ).toBe(true);
    });

    it("should reject invalid transitions from terminal states", () => {
      expect(
        isValidRequisitionTransition(WmsRequisitionStatus.COMPLETED, WmsRequisitionStatus.APPROVED)
      ).toBe(false);
      expect(
        isValidRequisitionTransition(WmsRequisitionStatus.REJECTED, WmsRequisitionStatus.COMPLETED)
      ).toBe(false);
    });
  });
});
