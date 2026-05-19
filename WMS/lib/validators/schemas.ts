import { z } from "zod";

export const warehouseStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const warehouseTypeSchema = z.enum(["PRIMARY", "AUXILIARY"]);
export const stockItemStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);
export const supplyPolicySchema = z.enum(["CENTRAL_ISSUE", "DISTRIBUTED_CONSUMABLE"]);
export const stockMovementTypeSchema = z.enum([
  "RECEIPT",
  "ISSUE",
  "TRANSFER",
  "ADJUSTMENT",
  "RESERVATION",
  "RESERVATION_CANCEL"
]);
export const stockReservationStatusSchema = z.enum(["ACTIVE", "ISSUED", "CANCELLED"]);

const decimalNumber = z.number().finite();

export const createWarehouseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  responsibleEmail: z.string().email().optional().or(z.literal("")),
  status: warehouseStatusSchema.default("ACTIVE"),
  type: warehouseTypeSchema.default("AUXILIARY")
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export const createStockItemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().min(1),
  minQuantity: decimalNumber.optional(),
  status: stockItemStatusSchema.default("ACTIVE"),
  supplyPolicy: supplyPolicySchema.default("DISTRIBUTED_CONSUMABLE")
});

export const updateStockItemSchema = createStockItemSchema.partial();

export const movementReceiptSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: decimalNumber.positive(),
  comment: z.string().optional(),
  createdBy: z.string().optional()
});

export const movementIssueSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().optional(),
  quantity: decimalNumber.positive(),
  recipientType: z.enum(["EQUIPMENT", "EMPLOYEE"]).optional(),
  recipientName: z.string().optional(),
  relatedMmsWorkOrderId: z.string().optional(),
  relatedMmsRequiredPartId: z.string().optional(),
  comment: z.string().optional(),
  createdBy: z.string().optional()
});

export const movementTransferSchema = z.object({
  itemId: z.string().min(1),
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  quantity: decimalNumber.positive(),
  comment: z.string().optional(),
  createdBy: z.string().optional()
});

export const movementAdjustmentSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantityDelta: decimalNumber,
  comment: z.string().optional(),
  createdBy: z.string().optional()
});

export const createReservationSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().optional(),
  mmsWorkOrderId: z.string().min(1),
  mmsRequiredPartId: z.string().min(1),
  quantity: decimalNumber.positive()
});

export const cancelReservationSchema = z.object({
  comment: z.string().optional(),
  createdBy: z.string().optional()
});

export const issueReservationSchema = z.object({
  comment: z.string().optional(),
  createdBy: z.string().optional()
});
