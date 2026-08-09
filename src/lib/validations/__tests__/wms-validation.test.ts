import { describe, it, expect } from "vitest";
import {
  positiveIntSchema,
  nonNegativeIntSchema,
  createWmsItemSchema,
  createReservationSchema,
  createWriteOffSchema,
  createTransferSchema,
} from "../wms";

describe("SEC-03: WMS Zod Validation Schemas", () => {
  describe("Quantities validation (positiveInt & nonNegativeInt)", () => {
    it("should accept valid positive integers", () => {
      expect(positiveIntSchema.parse(1)).toBe(1);
      expect(positiveIntSchema.parse(100)).toBe(100);
    });

    it("should reject zero, negative integers, floats, and non-numeric inputs for positiveInt", () => {
      expect(() => positiveIntSchema.parse(0)).toThrow();
      expect(() => positiveIntSchema.parse(-10)).toThrow();
      expect(() => positiveIntSchema.parse(1.5)).toThrow();
      expect(() => positiveIntSchema.parse("10")).toThrow();
      expect(() => positiveIntSchema.parse(null)).toThrow();
      expect(() => positiveIntSchema.parse(undefined)).toThrow();
    });

    it("should accept zero and positive integers for nonNegativeInt", () => {
      expect(nonNegativeIntSchema.parse(0)).toBe(0);
      expect(nonNegativeIntSchema.parse(50)).toBe(50);
    });

    it("should reject negative numbers and floats for nonNegativeInt", () => {
      expect(() => nonNegativeIntSchema.parse(-1)).toThrow();
      expect(() => nonNegativeIntSchema.parse(3.14)).toThrow();
    });
  });

  describe("Create WMS Item Schema (createWmsItemSchema)", () => {
    it("should parse valid WMS item payload", () => {
      const payload = {
        sku: "SKU-TEST-001",
        name: "Подшипник качения",
        category: "Запчасти",
        warehouse: "Главный склад",
        quantity: 10,
        minQuantity: 2,
        maxQuantity: 50,
        unitPrice: 1200.5,
      };

      const result = createWmsItemSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sku).toBe("SKU-TEST-001");
        expect(result.data.quantity).toBe(10);
      }
    });

    it("should reject invalid quantities and missing required fields", () => {
      const invalidPayload = {
        sku: "",
        name: "",
        warehouse: "Склад №1",
        quantity: -5,
      };

      const result = createWmsItemSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("Reservation Schema (createReservationSchema)", () => {
    it("should parse valid reservation payload", () => {
      const payload = {
        itemId: "item-cuid-123",
        quantity: 5,
        reservedBy: "Инженер Иванов",
        purpose: "Ремонт насоса",
      };

      const result = createReservationSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject zero or negative reserved quantities", () => {
      expect(
        createReservationSchema.safeParse({
          itemId: "item-123",
          quantity: 0,
          reservedBy: "User",
        }).success
      ).toBe(false);

      expect(
        createReservationSchema.safeParse({
          itemId: "item-123",
          quantity: -3,
          reservedBy: "User",
        }).success
      ).toBe(false);
    });
  });

  describe("WriteOff Schema (createWriteOffSchema)", () => {
    it("should parse valid write-off payload", () => {
      const payload = {
        itemId: "item-123",
        quantity: 2,
        reason: "SCRAP",
        approvedBy: "Главный механик",
      };

      const result = createWriteOffSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject non-enum write-off reason", () => {
      const result = createWriteOffSchema.safeParse({
        itemId: "item-123",
        quantity: 2,
        reason: "INVALID_REASON",
        approvedBy: "User",
      });

      expect(result.success).toBe(false);
    });
  });
});
