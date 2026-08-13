/**
 * Утилиты для конвертации данных между Zod схемами и Prisma моделями
 *
 * Zod схемы принимают даты как строки (ISO 8601), а Prisma ожидает Date объекты.
 * Эти хелперы обеспечивают безопасную конвертацию без использования `as unknown as`.
 */
import { Prisma } from "@prisma/client";

/**
 * Конвертирует ISO строку даты в Date объект или null
 */
export function toDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date string: ${value}`);
    }
    return date;
}

/**
 * Конвертирует ISO строку даты в Date объект (без null/undefined)
 */
export function toDateRequired(value: string | null | undefined): Date | null {
    if (value === null || value === undefined) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date string: ${value}`);
    }
    return date;
}

/**
 * Безопасно конвертирует JSON значение в Prisma.InputJsonValue
 */
export function toJsonInput(value: unknown): Prisma.InputJsonValue | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    if (Array.isArray(value) || typeof value === "object") {
        return value as Prisma.InputJsonValue;
    }
    return null;
}

/**
 * Конвертирует nullable string в Prisma.NullableStringInput
 */
export function toNullableString(value: string | null | undefined): Prisma.NullableStringFieldUpdateOperationsInput | string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return { set: null };
    return value;
}
