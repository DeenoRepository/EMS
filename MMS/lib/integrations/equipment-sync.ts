import { prisma } from "@/lib/db/prisma";
import { fetchEquipmentList } from "@/lib/integrations/eps-client";

type SyncOptions = {
  pageSize: number;
  maxPages: number;
  actorId?: string;
};

type SyncResult = {
  ok: boolean;
  upserted: number;
  total: number;
  pagesRead: number;
  createdPlans: number;
  createdTasks: number;
};

let runningSync: Promise<SyncResult> | null = null;

function getDefaultPlanSettings() {
  const intervalDays = Number(process.env.DEFAULT_PPR_INTERVAL_DAYS || "90");
  const horizonMonths = Number(process.env.DEFAULT_PPR_HORIZON_MONTHS || "12");
  const maintenanceTypeRaw = (process.env.DEFAULT_PPR_MAINTENANCE_TYPE || "PREVENTIVE").toUpperCase();
  const allowed: Array<"PREVENTIVE" | "SEASONAL" | "CAPITAL" | "DIAGNOSTIC"> = [
    "PREVENTIVE",
    "SEASONAL",
    "CAPITAL",
    "DIAGNOSTIC"
  ];
  const maintenanceType = allowed.includes(maintenanceTypeRaw as any)
    ? (maintenanceTypeRaw as "PREVENTIVE" | "SEASONAL" | "CAPITAL" | "DIAGNOSTIC")
    : "PREVENTIVE";

  return {
    intervalDays: Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 90,
    horizonMonths: Number.isFinite(horizonMonths) && horizonMonths > 0 ? horizonMonths : 12,
    maintenanceType
  };
}

async function ensureIndividualPlan(params: {
  equipmentId: string;
  equipmentCode?: string | null;
  equipmentName: string;
  actorId?: string;
}) {
  const existing = await prisma.pprPlan.findFirst({
    where: {
      equipmentId: params.equipmentId,
      status: { in: ["ACTIVE", "PAUSED"] }
    }
  });

  if (existing) {
    await prisma.pprPlan.update({
      where: { id: existing.id },
      data: {
        equipmentCode: params.equipmentCode || null,
        equipmentName: params.equipmentName
      }
    });
    return { createdPlan: false, createdTasks: 0 };
  }

  const defaults = getDefaultPlanSettings();
  const lastServiceDate = new Date();
  const nextServiceDate = new Date();
  nextServiceDate.setDate(nextServiceDate.getDate() + defaults.intervalDays);

  const plan = await prisma.pprPlan.create({
    data: {
      equipmentId: params.equipmentId,
      equipmentCode: params.equipmentCode || null,
      equipmentName: params.equipmentName,
      maintenanceType: defaults.maintenanceType,
      intervalDays: defaults.intervalDays,
      horizonMonths: defaults.horizonMonths,
      lastServiceDate,
      nextServiceDate,
      comments: "Автоматически сформировано после синхронизации оборудования",
      status: "ACTIVE",
      createdById: params.actorId,
      updatedById: params.actorId
    }
  });

  const horizonEnd = new Date();
  horizonEnd.setMonth(horizonEnd.getMonth() + defaults.horizonMonths);
  let cursor = new Date(nextServiceDate);
  const tasks: Array<{ scheduledDate: Date }> = [];
  while (cursor <= horizonEnd) {
    tasks.push({ scheduledDate: new Date(cursor) });
    cursor.setDate(cursor.getDate() + defaults.intervalDays);
  }

  if (tasks.length) {
    await prisma.pprTask.createMany({
      data: tasks.map((task) => ({
        planId: plan.id,
        equipmentId: params.equipmentId,
        scheduledDate: task.scheduledDate,
        maintenanceType: defaults.maintenanceType,
        status: task.scheduledDate < new Date() ? "OVERDUE" : "PLANNED",
        createdById: params.actorId,
        updatedById: params.actorId
      }))
    });
  }

  return { createdPlan: true, createdTasks: tasks.length };
}

export async function syncEquipmentAndGeneratePlans(options: SyncOptions): Promise<SyncResult> {
  let page = 1;
  let total = 0;
  let upserted = 0;
  let createdPlans = 0;
  let createdTasks = 0;

  while (page <= options.maxPages) {
    const chunk = await fetchEquipmentList({ page, pageSize: options.pageSize });
    total = chunk.total || 0;
    if (!chunk.items?.length) break;

    for (const item of chunk.items) {
      await prisma.syncedEquipment.upsert({
        where: { id: item.id },
        update: {
          equipmentCode: item.equipmentCode || null,
          name: item.name || "Без названия",
          type: item.type || null,
          category: item.category || null,
          model: item.model || null,
          serialNumber: item.serialNumber || null,
          inventoryNumber: item.inventoryNumber || null,
          department: item.department || null,
          location: item.location || null,
          status: item.status || null,
          lifecycleStage: item.lifecycleStage || null,
          payload: item,
          lastSyncedAt: new Date()
        },
        create: {
          id: item.id,
          equipmentCode: item.equipmentCode || null,
          name: item.name || "Без названия",
          type: item.type || null,
          category: item.category || null,
          model: item.model || null,
          serialNumber: item.serialNumber || null,
          inventoryNumber: item.inventoryNumber || null,
          department: item.department || null,
          location: item.location || null,
          status: item.status || null,
          lifecycleStage: item.lifecycleStage || null,
          payload: item,
          lastSyncedAt: new Date()
        }
      });
      upserted += 1;

      const created = await ensureIndividualPlan({
        equipmentId: item.id,
        equipmentCode: item.equipmentCode || null,
        equipmentName: item.name || "Без названия",
        actorId: options.actorId
      });
      if (created.createdPlan) createdPlans += 1;
      createdTasks += created.createdTasks;
    }

    if (page * options.pageSize >= total) break;
    page += 1;
  }

  return {
    ok: true,
    upserted,
    total,
    pagesRead: page,
    createdPlans,
    createdTasks
  };
}

async function runSyncWithState(reason: string) {
  const pageSize = Math.min(Math.max(Number(process.env.EPS_SYNC_PAGE_SIZE || "100"), 1), 200);
  const maxPages = Math.max(Number(process.env.EPS_SYNC_MAX_PAGES || "200"), 1);
  const stateKey = "equipment_registry";

  await prisma.syncState.upsert({
    where: { key: stateKey },
    update: {
      status: "RUNNING",
      message: reason,
      lastStartedAt: new Date()
    },
    create: {
      key: stateKey,
      status: "RUNNING",
      message: reason,
      lastStartedAt: new Date()
    }
  });

  try {
    const result = await syncEquipmentAndGeneratePlans({ pageSize, maxPages });
    await prisma.syncState.update({
      where: { key: stateKey },
      data: {
        status: "SUCCESS",
        message: `upserted=${result.upserted}, plans=${result.createdPlans}, tasks=${result.createdTasks}`,
        lastFinishedAt: new Date(),
        lastSuccessAt: new Date()
      }
    });
    return result;
  } catch (error) {
    await prisma.syncState.update({
      where: { key: stateKey },
      data: {
        status: "FAILED",
        message: error instanceof Error ? error.message : "unknown error",
        lastFinishedAt: new Date()
      }
    });
    throw error;
  }
}

export async function maybeAutoSyncEquipment() {
  const enabled = (process.env.AUTO_SYNC_EQUIPMENT || "true").toLowerCase() !== "false";
  if (!enabled) return { triggered: false, reason: "disabled" as const };

  const intervalMinutes = Math.max(Number(process.env.AUTO_SYNC_INTERVAL_MINUTES || "30"), 1);
  const state = await prisma.syncState.findUnique({ where: { key: "equipment_registry" } });
  const lastSuccessAt = state?.lastSuccessAt?.getTime() || 0;
  const due = Date.now() - lastSuccessAt >= intervalMinutes * 60_000;

  if (!due) {
    return { triggered: false, reason: "fresh" as const };
  }

  if (!runningSync) {
    runningSync = runSyncWithState("auto").finally(() => {
      runningSync = null;
    });
  }

  await runningSync;
  return { triggered: true, reason: "synced" as const };
}
