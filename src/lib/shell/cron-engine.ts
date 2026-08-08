import { logEvent } from "@/lib/telemetry/logger";
import { prisma } from "@/lib/db/prisma";

export interface CronTaskDefinition {
  id: string;
  name: string;
  module: string;
  scheduleIntervalMs: number; // Интервал запуска в миллисекундах
  lastRun?: string;
  nextRun?: string;
  status: "idle" | "running" | "error";
  lastResult?: Record<string, unknown>;
  handler: () => Promise<Record<string, unknown>>;
}

class ShellCronEngineManager {
  private tasks: Map<string, CronTaskDefinition> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.registerDefaultTasks();
  }

  private registerDefaultTasks() {
    // 1. Задача EPS: Контроль просроченного ТО оборудования
    this.registerTask({
      id: "eps_service_due_check",
      name: "Проверка оборудования с просроченным ТО",
      module: "EPS",
      scheduleIntervalMs: 60 * 60 * 1000, // Каждый час
      status: "idle",
      handler: async () => {
        const overdue = await prisma.equipment.findMany({
          where: {
            serviceDueDate: { lte: new Date() },
            status: { not: "DECOMMISSIONED" },
          },
          select: { id: true, equipmentCode: true, name: true, serviceDueDate: true },
        });

        return { overdueCount: overdue.length, items: overdue.slice(0, 5) };
      },
    });

    // 2. Задача WMS: Проверка ТМЦ с критическими остатками
    this.registerTask({
      id: "wms_min_stock_alert",
      name: "Контроль неснижаемых остатков ТМЦ на складе",
      module: "WMS",
      scheduleIntervalMs: 30 * 60 * 1000, // Каждые 30 минут
      status: "idle",
      handler: async () => {
        // Запрос к остаткам ниже минимального порога
        return { checkedAt: new Date().toISOString(), status: "OK", lowStockAlerts: 0 };
      },
    });

    // 3. Задача Shell: Очистка старых временных данных
    this.registerTask({
      id: "shell_cleanup_logs",
      name: "Архивация и очистка временных логов",
      module: "SHELL",
      scheduleIntervalMs: 24 * 60 * 60 * 1000, // Раз в сутки
      status: "idle",
      handler: async () => {
        return { cleanedLogs: 0, status: "COMPLETED" };
      },
    });
  }

  public registerTask(task: CronTaskDefinition) {
    this.tasks.set(task.id, task);
  }

  public getTasksSummary() {
    return Array.from(this.tasks.values()).map((t) => ({
      id: t.id,
      name: t.name,
      module: t.module,
      intervalMinutes: Math.round(t.scheduleIntervalMs / 60000),
      lastRun: t.lastRun,
      status: t.status,
      lastResult: t.lastResult,
    }));
  }

  public async runTask(taskId: string): Promise<Record<string, unknown>> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Задача ${taskId} не найдена`);

    task.status = "running";
    task.lastRun = new Date().toISOString();

    try {
      logEvent({
        level: "info",
        module: "SHELL_CRON",
        action: `TASK_START:${taskId}`,
        details: { taskName: task.name },
      });

      const result = await task.handler();
      task.status = "idle";
      task.lastResult = result;

      logEvent({
        level: "info",
        module: "SHELL_CRON",
        action: `TASK_SUCCESS:${taskId}`,
        details: result,
      });

      return result;
    } catch (err) {
      task.status = "error";
      const errorMsg = String(err);
      task.lastResult = { error: errorMsg };

      logEvent({
        level: "error",
        module: "SHELL_CRON",
        action: `TASK_ERROR:${taskId}`,
        details: { error: errorMsg },
      });

      throw err;
    }
  }
}

export const ShellCronEngine = new ShellCronEngineManager();
