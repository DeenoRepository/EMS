import { z } from "zod";

const dateSchema = z.string().min(1).refine((val) => {
  const d = new Date(val);
  return !Number.isNaN(d.getTime());
}, { message: "Invalid date format" });

export const maintenanceTypeSchema = z.enum(["PREVENTIVE", "SEASONAL", "CAPITAL", "DIAGNOSTIC"]);
export const planStatusSchema = z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]);
export const taskStatusSchema = z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELED", "OVERDUE"]);
export const workOrderTypeSchema = z.enum(["PLANNED", "CORRECTIVE", "EMERGENCY"]);
export const workOrderPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const workOrderStatusSchema = z.enum(["NEW", "APPROVED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELED"]);

export const createPprPlanSchema = z.object({
  equipmentId: z.string().min(1),
  equipmentCode: z.string().optional(),
  equipmentName: z.string().optional(),
  maintenanceType: maintenanceTypeSchema.default("PREVENTIVE"),
  intervalDays: z.number().int().min(1).max(3650),
  horizonMonths: z.number().int().min(1).max(60).default(12),
  lastServiceDate: dateSchema,
  comments: z.string().optional()
});

export const updatePprPlanSchema = createPprPlanSchema
  .partial()
  .extend({
    status: planStatusSchema.optional()
  });

export const generatePlanTasksSchema = z.object({
  replaceFutureTasks: z.boolean().default(false),
  limit: z.number().int().min(1).max(120).default(24)
});

export const createPprTaskSchema = z.object({
  planId: z.string().optional(),
  equipmentId: z.string().min(1),
  scheduledDate: dateSchema,
  maintenanceType: maintenanceTypeSchema,
  status: taskStatusSchema.optional(),
  resultNotes: z.string().optional(),
  laborHours: z.number().min(0).max(10000).optional(),
  totalCost: z.number().min(0).max(1_000_000_000).optional(),
  spareParts: z
    .array(
      z.object({
        sku: z.string().min(1),
        name: z.string().min(1),
        quantity: z.number().min(0.0001),
        unit: z.string().min(1).default("шт")
      })
    )
    .optional()
});

export const updatePprTaskSchema = createPprTaskSchema
  .partial()
  .extend({
    status: taskStatusSchema.optional(),
    performedAt: dateSchema.optional(),
    warehouseReservationId: z.string().optional()
  });

export const bulkUpdatePprTasksSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  status: taskStatusSchema.optional(),
  performedAt: dateSchema.optional(),
  scheduledDate: dateSchema.optional()
});

export const epsEquipmentSearchSchema = z.object({
  q: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20)
});

export const warehouseAvailabilitySchema = z.object({
  equipmentId: z.string().min(1),
  items: z.array(
    z.object({
      sku: z.string().min(1),
      quantity: z.number().min(0.0001)
    })
  )
});

export const warehouseReservationSchema = z.object({
  equipmentId: z.string().min(1),
  taskId: z.string().optional(),
  workOrderId: z.string().optional(),
  items: z.array(
    z.object({
      sku: z.string().min(1),
      quantity: z.number().min(0.0001),
      note: z.string().optional()
    })
  )
});

export const syncEquipmentSchema = z.object({
  pageSize: z.number().int().min(1).max(200).default(100),
  maxPages: z.number().int().min(1).max(1000).default(200)
});

export const generatePlansFromRegistrySchema = z.object({
  intervalDays: z.number().int().min(1).max(3650).default(90),
  horizonMonths: z.number().int().min(1).max(60).default(12),
  maintenanceType: maintenanceTypeSchema.default("PREVENTIVE"),
  statusFilter: z.array(z.string()).optional(),
  lifecycleFilter: z.array(z.string()).optional(),
  dryRun: z.boolean().default(false)
});

const failureSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const rcaStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]);

export const failureCreateSchema = z.object({
  equipmentId: z.string().min(1),
  equipmentCode: z.string().optional(),
  equipmentName: z.string().optional(),
  occurredAt: dateSchema,
  resolvedAt: dateSchema.optional(),
  downtimeMinutes: z.number().int().min(0).max(1_000_000).optional(),
  failureNode: z.string().optional(),
  symptom: z.string().min(2),
  rootCauseCategory: z.string().optional(),
  rootCauseDetail: z.string().optional(),
  severity: failureSeveritySchema.optional(),
  rcaStatus: rcaStatusSchema.optional(),
  correctiveAction: z.string().optional(),
  preventiveAction: z.string().optional(),
  owner: z.string().optional(),
  dueDate: dateSchema.optional(),
  closedAt: dateSchema.optional()
});

export const failureUpdateSchema = failureCreateSchema.partial();

export const bulkUpdateFailuresSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  severity: failureSeveritySchema.optional(),
  rcaStatus: rcaStatusSchema.optional(),
  owner: z.string().optional(),
  dueDate: dateSchema.optional(),
  closedAt: dateSchema.optional()
});

export const createWorkOrderSchema = z.object({
  equipmentId: z.string().min(1),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  type: workOrderTypeSchema.default("CORRECTIVE"),
  priority: workOrderPrioritySchema.default("MEDIUM"),
  sourceFailureId: z.string().optional(),
  relatedTaskId: z.string().optional(),
  assignedTo: z.string().optional(),
  requestedBy: z.string().optional(),
  plannedStartAt: dateSchema.optional(),
  plannedEndAt: dateSchema.optional(),
  slaResponseMinutes: z.number().int().min(1).max(10080).optional(),
  slaResolveMinutes: z.number().int().min(1).max(10080).optional(),
  estimatedLaborHours: z.number().min(0).max(10000).optional(),
  estimatedCost: z.number().min(0).max(1_000_000_000).optional(),
  metadata: z.record(z.any()).optional()
});

export const updateWorkOrderSchema = createWorkOrderSchema
  .partial()
  .extend({
    status: workOrderStatusSchema.optional(),
    actualStartAt: dateSchema.optional(),
    actualEndAt: dateSchema.optional(),
    actualLaborHours: z.number().min(0).max(10000).optional(),
    actualCost: z.number().min(0).max(1_000_000_000).optional(),
    downtimeMinutes: z.number().int().min(0).max(1_000_000).optional(),
    externalEpsId: z.string().optional(),
    externalWmsId: z.string().optional()
  });

export const scheduleQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  assignee: z.string().optional()
});

export const scheduleAssignSchema = z.object({
  workOrderId: z.string().min(1),
  assignedTo: z.string().min(1),
  plannedStartAt: dateSchema,
  plannedEndAt: dateSchema,
  status: workOrderStatusSchema.optional()
});
