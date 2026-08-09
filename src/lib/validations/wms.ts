import { z } from "zod";
import {
  WmsItemType,
  WmsItemStatus,
  WmsMovementType,
  WmsTransferStatus,
  WmsRequisitionStatus,
  WmsWriteOffReason,
} from "@prisma/client";

// --- Базовые типы данных WMS ---

/**
 * Валидатор ID и кодов
 */
export const wmsIdSchema = z.string().min(1, "ID не может быть пустым").trim();
export const wmsCodeSchema = z
  .string()
  .min(1, "Код/артикул не может быть пустым")
  .max(100, "Превышена максимальная длина (100 символов)")
  .trim();

/**
 * Валидаторы количеств (SEC-03):
 * - positiveInt: строго положительное целое число (>0) для операций прихода, списания, резервирования и трансферов.
 * - nonNegativeInt: неотрицательное целое число (>=0) для остатков и лимитов.
 */
export const positiveIntSchema = z
  .number({
    message: "Количество должно быть целым числом",
  })
  .int("Количество должно быть целым числом")
  .gt(0, "Количество должно быть больше нуля");

export const nonNegativeIntSchema = z
  .number({
    message: "Количество должно быть целым числом",
  })
  .int("Количество должно быть целым числом")
  .gte(0, "Количество не может быть отрицательным");

export const positiveFloatSchema = z
  .number({
    message: "Цена должна быть числом",
  })
  .gte(0, "Цена не может быть отрицательной");

// --- Перечисления (Enums) ---

export const wmsItemTypeSchema = z.nativeEnum(WmsItemType);
export const wmsItemStatusSchema = z.nativeEnum(WmsItemStatus);
export const wmsMovementTypeSchema = z.nativeEnum(WmsMovementType);
export const wmsTransferStatusSchema = z.nativeEnum(WmsTransferStatus);
export const wmsRequisitionStatusSchema = z.nativeEnum(WmsRequisitionStatus);
export const wmsWriteOffReasonSchema = z.nativeEnum(WmsWriteOffReason);

// --- Схемы объектов API запросов WMS ---

/**
 * Валидация создания/прихода ТМЦ (POST /api/modules/wms/items)
 */
export const createWmsItemSchema = z.object({
  sku: wmsCodeSchema,
  name: z.string().min(1, "Наименование обязательно").max(255).trim(),
  category: z.string().min(1, "Категория обязательна").max(100).trim(),
  type: wmsItemTypeSchema.default(WmsItemType.ZIP),
  unit: z.string().min(1).default("pcs"),
  warehouse: z.string().min(1, "Склад обязателен").trim(),
  cell: z.string().optional().nullable(),
  zone: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  quantity: nonNegativeIntSchema.default(0),
  minQuantity: nonNegativeIntSchema.default(0),
  maxQuantity: nonNegativeIntSchema.default(100),
  unitPrice: positiveFloatSchema.default(0),
  currency: z.string().default("RUB"),
  supplier: z.string().optional().nullable(),
  responsibleUser: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  isEps: z.boolean().default(false),
  equipmentId: z.string().optional().nullable(),
});

/**
 * Валидация изменения ТМЦ (PUT/PATCH /api/modules/wms/items/[id])
 */
export const updateWmsItemSchema = createWmsItemSchema.partial();

/**
 * Валидация создания резерва (POST /api/modules/wms/reservations)
 */
export const createReservationSchema = z.object({
  itemId: wmsIdSchema,
  quantity: positiveIntSchema,
  reservedBy: z.string().min(1, "Укажите инициатора резерва").trim(),
  purpose: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * Валидация создания списания (POST /api/modules/wms/write-offs)
 */
export const createWriteOffSchema = z.object({
  itemId: wmsIdSchema,
  quantity: positiveIntSchema,
  reason: wmsWriteOffReasonSchema,
  approvedBy: z.string().min(1, "Укажите лицо, утвердившее списание").trim(),
  actNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  equipmentId: z.string().optional().nullable(),
});

/**
 * Валидация перемещения/трансфера (POST /api/modules/wms/transfers)
 */
export const createTransferSchema = z.object({
  fromWarehouse: z.string().min(1, "Укажите склад-отправитель").trim(),
  toWarehouse: z.string().min(1, "Укажите склад-получатель").trim(),
  initiatedBy: z.string().min(1, "Укажите инициатора перемещения").trim(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        itemId: wmsIdSchema,
        quantity: positiveIntSchema,
      })
    )
    .min(1, "Укажите хотя бы одну позицию для перемещения"),
});

/**
 * Валидация личной карточки / выдачи спецодежды (POST /api/modules/wms/personal-cards)
 */
export const issuePersonalCardSchema = z.object({
  employeeId: z.string().min(1, "Укажите сотрудника").trim(),
  itemId: wmsIdSchema,
  quantity: positiveIntSchema,
  issuedBy: z.string().min(1, "Укажите выдавшее лицо").trim(),
  notes: z.string().optional().nullable(),
});
