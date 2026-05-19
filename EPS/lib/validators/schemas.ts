import { z } from "zod";

const equipmentStatus = z.enum(["DRAFT", "ACTIVE", "INACTIVE", "DECOMMISSIONED"]);
const lifecycleStage = z.enum(["PLANNED", "COMMISSIONED", "IN_OPERATION", "MAINTENANCE", "RETIRED"]);
const approvalStatus = z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELED"]);

export const equipmentCreateSchema = z.object({
  equipmentCode: z.string().min(3),
  name: z.string().min(2),
  type: z.string().optional(),
  category: z.string().optional(),
  model: z.string().min(1),
  serialNumber: z.string().optional(),
  inventoryNumber: z.string().optional(),
  department: z.string().optional(),
  responsibleUserId: z.string().optional(),
  manufacturer: z.string().optional(),
  supplier: z.string().optional(),
  productionDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  commissioningDate: z.string().optional(),
  location: z.string().optional(),
  status: equipmentStatus.optional(),
  lifecycleStage: lifecycleStage.optional(),
  warrantyExpiration: z.string().optional(),
  serviceDueDate: z.string().optional(),
  notes: z.string().optional(),
  customAttributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  submitForApproval: z.boolean().optional(),
  changeSummary: z.string().optional()
});

export const equipmentUpdateSchema = equipmentCreateSchema.partial().extend({
  status: equipmentStatus.optional(),
  lifecycleStage: lifecycleStage.optional(),
  submitForApproval: z.boolean().optional(),
  changeSummary: z.string().optional()
});

export const documentCreateSchema = z.object({
  equipmentId: z.string(),
  title: z.string().min(2),
  docType: z.enum(["PASSPORT", "OPERATION_MANUAL", "CERTIFICATE", "ACT", "DRAWING", "OTHER"]),
  fileName: z.string().min(1),
  storagePath: z.string().min(1),
  checksum: z.string().min(3),
  notes: z.string().optional()
});

export const documentUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  docType: z.enum(["PASSPORT", "OPERATION_MANUAL", "CERTIFICATE", "ACT", "DRAWING", "OTHER"]).optional(),
  fileName: z.string().min(1).optional(),
  storagePath: z.string().min(1).optional(),
  checksum: z.string().min(3).optional(),
  notes: z.string().optional()
});

export const approvalDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  comments: z.string().optional()
});

export const approvalCreateSchema = z.object({
  targetType: z.enum(["EQUIPMENT_VERSION", "DOCUMENT_VERSION"]),
  targetId: z.string().min(1),
  assignedApproverId: z.string().optional(),
  status: approvalStatus.optional(),
  comments: z.string().optional()
});

export const equipmentMaintenanceSchema = z
  .object({
    mode: z.enum(["ENTER", "EXIT"]),
    comments: z.string().optional(),
    fileName: z.string().optional(),
    storagePath: z.string().optional(),
    checksum: z.string().optional(),
    notes: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.mode !== "EXIT") return;
    if (!value.fileName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fileName"], message: "fileName is required for EXIT" });
    }
    if (!value.storagePath?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["storagePath"], message: "storagePath is required for EXIT" });
    }
    if (!value.checksum?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["checksum"], message: "checksum is required for EXIT" });
    }
  });

export const equipmentPprPlanSchema = z.object({
  lastServiceDate: z.string().min(1),
  intervalDays: z.number().int().min(1).max(3650),
  horizonMonths: z.number().int().min(1).max(60),
  maintenanceType: z.enum(["PREVENTIVE", "SEASONAL", "CAPITAL", "DIAGNOSTIC"]).default("PREVENTIVE"),
  intervalMaintenanceTypes: z
    .array(
      z.object({
        date: z.string().min(1),
        maintenanceType: z.enum(["PREVENTIVE", "SEASONAL", "CAPITAL", "DIAGNOSTIC"])
      })
    )
    .optional(),
  comments: z.string().trim().min(5, "Укажите цель отправки плана ППР")
});

export const referenceFieldCreateSchema = z.object({
  entityType: z.enum(["EQUIPMENT"]).default("EQUIPMENT"),
  key: z.string().min(2).max(64).regex(/^[a-zA-Z0-9_]+$/),
  label: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional()
});

export const referenceFieldUpdateSchema = referenceFieldCreateSchema.partial();

export const referenceValueCreateSchema = z.object({
  value: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional()
});

export const referenceValueUpdateSchema = referenceValueCreateSchema.partial();

export const equipmentTypeAttributeCreateSchema = z.object({
  typeValue: z.string().min(1).max(120),
  key: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_]+$/),
  label: z.string().min(1).max(120),
  dataType: z.enum(["TEXT", "NUMBER", "DATE", "SELECT"]).default("TEXT"),
  required: z.boolean().optional(),
  options: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  description: z.string().max(500).optional()
});

export const equipmentTypeAttributeUpdateSchema = equipmentTypeAttributeCreateSchema.partial();

