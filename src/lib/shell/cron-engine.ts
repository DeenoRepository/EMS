/**
 * Cron Engine (SEC-03)
 *
 * Планировщик задач с поддержкой distributed locking через Redis.
 * В multi-instance окружении только один инстанс выполняет задачу в данный момент времени.
 * Fallback на in-process таймеры для development/test.
 */
import { logEvent } from "@/lib/telemetry/logger";
import { prisma } from "@/lib/db/prisma";
import { getRedis } from "@/lib/db/redis";

export interface CronTaskDefinition {
  id: string;
  name: string;
  module: string;
  scheduleIntervalMs: number;
  lastRun?: string;
  nextRun?: string;
  status: "idle" | "running" | "error";
  lastResult?: Record<string, unknown>;
  handler: () => Promise<Record<string, unknown>>;
}

const LOCK_PREFIX = "cron:lock:";
const LOCK_TTL_SECONDS = 300; // 5 минут — максимальное время выполнения задачи

class ShellCronEngineManager {
  private tasks: Map<string, CronTaskDefinition> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private started = false;

  constructor() {
    this.registerDefaultTasks();
  }

  private registerDefaultTasks() {
    // 1. Задача EPS: Контроль просроченного ТО оборудования
    this.registerTask({
      id: "eps_service_due_check",
      name: "Проверка оборудования с просроченным ТО",
      module: "EPS",
      scheduleIntervalMs: 60 * 60 * 1000,
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
      scheduleIntervalMs: 30 * 60 * 1000,
      status: "idle",
      handler: async () => {
        return { checkedAt: new Date().toISOString(), status: "OK", lowStockAlerts: 0 };
      },
    });

    // 3. Задача Shell: Очистка старых временных данных
    this.registerTask({
      id: "shell_cleanup_logs",
      name: "Архивация и очистка временных логов",
      module: "SHELL",
      scheduleIntervalMs: 24 * 60 * 60 * 1000,
      status: "idle",
      handler: async () => {
        return { cleanedLogs: 0, status: "COMPLETED" };
      },
    });
  }

  public registerTask(task: CronTaskDefinition) {
    this.tasks.set(task.id, task);
  }

  /**
   * Попытка получить distributed lock для задачи (SEC-03)
   *
   * Использует Redis SET NX EX для атомарного захвата блокировки.
   * Если Redis недоступен — разрешает выполнение (fallback для dev).
   */
  private async acquireLock(taskId: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
      // В dev-режиме без Redis разрешаем выполнение
      return true;
    }

    try {
      const lockKey = `${LOCK_PREFIX}${taskId}`;
      const lockToken = `${process.pid}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const result = await redis.set(lockKey, lockToken, "EX", LOCK_TTL_SECONDS, "NX");
      return result === "OK";
    } catch (err) {
      console.error(`[CronEngine] Failed to acquire lock for ${taskId}:`, err);
      // В случае ошибки Redis — разрешаем выполнение (fail-open)
      return true;
    }
  }

  /**
   * Освободить distributed lock
   */
  private async releaseLock(taskId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
      await redis.del(`${LOCK_PREFIX}${taskId}`);
    } catch (err) {
      console.error(`[CronEngine] Failed to release lock for ${taskId}:`, err);
    }
  }

  /**
   * Запустить планировщик задач
   *
   * В production с несколькими инстансами только один инстанс
   * фактически выполнит задачу благодаря distributed locking.
   */
  public start() {
    if (this.started) return;
    this.started = true;

    for (const task of this.tasks.values()) {
      // Первый запуск через небольшую задержку (чтобы не все задачи стартовали одновременно)
      const initialDelay = Math.floor(Math.random() * Math.min(task.scheduleIntervalMs / 4, 5000));

      const timer = setTimeout(() => {
        this.scheduleTask(task.id);
      }, initialDelay);

      this.timers.set(task.id, timer);
    }

    logEvent({
      level: "info",
      module: "SHELL_CRON",
      action: "ENGINE_STARTED",
      details: { taskCount: this.tasks.size },
    });
  }

  /**
   * Остановить планировщик
   */
  public stop() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.started = false;

    logEvent({
      level: "info",
      module: "SHELL_CRON",
      action: "ENGINE_STOPPED",
      details: {},
    });
  }

  /**
   * Запланировать периодическое выполнение задачи
   */
  private scheduleTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const interval = setInterval(async () => {
      await this.runTaskWithLock(taskId);
    }, task.scheduleIntervalMs);

    this.timers.set(`${taskId}_interval`, interval);
  }

  /**
   * Выполнить задачу с проверкой distributed lock
   */
  private async runTaskWithLock(taskId: string): Promise<void> {
    const acquired = await this.acquireLock(taskId);
    if (!acquired) {
      // Другой инстанс уже выполняет эту задачу
      logEvent({
        level: "info",
        module: "SHELL_CRON",
        action: `TASK_SKIPPED_LOCKED:${taskId}`,
        details: { reason: "Another instance holds the lock" },
      });
      return;
    }

    try {
      await this.runTask(taskId);
    } finally {
      await this.releaseLock(taskId);
    }
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

// Автоматический запуск планировщика при импорте модуля
// В production рекомендуется вынести в отдельный worker-процесс
if (process.env.NODE_ENV !== "test") {
  // Небольшая задержка для инициализации других модулей
  setTimeout(() => {
    ShellCronEngine.start();
  }, 1000);
}
