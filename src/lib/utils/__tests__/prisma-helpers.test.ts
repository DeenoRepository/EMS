/**
 * Unit tests for prisma-helpers utility
 */
import { describe, it, expect } from "vitest";
import { toDate, toDateRequired, toJsonInput, toNullableString } from "../prisma-helpers";

describe("prisma-helpers", () => {
    describe("toDate", () => {
        it("should convert ISO string to Date", () => {
            const result = toDate("2024-01-15T10:00:00Z");
            expect(result).toBeInstanceOf(Date);
            expect((result as Date).toISOString()).toBe("2024-01-15T10:00:00.000Z");
        });

        it("should return undefined for undefined input", () => {
            expect(toDate(undefined)).toBeUndefined();
        });

        it("should return null for null input", () => {
            expect(toDate(null)).toBeNull();
        });

        it("should throw for invalid date string", () => {
            expect(() => toDate("not-a-date")).toThrow("Invalid date string");
        });
    });

    describe("toDateRequired", () => {
        it("should convert ISO string to Date", () => {
            const result = toDateRequired("2024-01-15T10:00:00Z");
            expect(result).toBeInstanceOf(Date);
        });

        it("should return null for null input", () => {
            expect(toDateRequired(null)).toBeNull();
        });

        it("should return null for undefined input", () => {
            expect(toDateRequired(undefined)).toBeNull();
        });

        it("should throw for invalid date string", () => {
            expect(() => toDateRequired("invalid")).toThrow("Invalid date string");
        });
    });

    describe("toJsonInput", () => {
        it("should pass through string", () => {
            expect(toJsonInput("hello")).toBe("hello");
        });

        it("should pass through number", () => {
            expect(toJsonInput(42)).toBe(42);
        });

        it("should pass through boolean", () => {
            expect(toJsonInput(true)).toBe(true);
        });

        it("should pass through object", () => {
            const obj = { key: "value" };
            expect(toJsonInput(obj)).toBe(obj);
        });

        it("should pass through array", () => {
            const arr = [1, 2, 3];
            expect(toJsonInput(arr)).toBe(arr);
        });

        it("should return undefined for undefined", () => {
            expect(toJsonInput(undefined)).toBeUndefined();
        });

        it("should return null for null", () => {
            expect(toJsonInput(null)).toBeNull();
        });
    });

    describe("toNullableString", () => {
        it("should return string as-is", () => {
            expect(toNullableString("hello")).toBe("hello");
        });

        it("should return undefined for undefined", () => {
            expect(toNullableString(undefined)).toBeUndefined();
        });

        it("should return { set: null } for null", () => {
            expect(toNullableString(null)).toEqual({ set: null });
        });
    });
});
