import { logEvent } from "@/lib/telemetry/logger";
import { setWithTTL, get, del } from "@/lib/db/redis";

export type ModuleHealthStatus = "ONLINE" | "DEGRADED" | "OFFLINE";

export interface ModuleHealthInfo {
  moduleId: string;
  status: ModuleHealthStatus;
  consecutiveFailures: number;
  lastFailureTime?: string;
  lastSuccessTime?: string;
  errorMessage?: string;
}

const HEALTH_PREFIX = "circuit:health:";
const HEALTH_TTL = 24 * 60 * 60; // 24 часа

class ModuleCircuitBreakerManager {
  private readonly FAILURE_THRESHOLD = 3;
  private readonly memoryFallback = new Map<string, ModuleHealthInfo>();

  constructor() {
    // Инициализация базовых модулей
    this.initModule("eps");
    this.initModule("wms");
  }

  private async initModule(moduleId: string) {
    const key = `${HEALTH_PREFIX}${moduleId}`;
    const existing = await get(key);
    if (!existing) {
      const info: ModuleHealthInfo = {
        moduleId,
        status: "ONLINE",
        consecutiveFailures: 0,
      };
      await this.saveHealth(moduleId, info);
    }
  }

  private async saveHealth(moduleId: string, info: ModuleHealthInfo) {
    const key = `${HEALTH_PREFIX}${moduleId}`;
    await setWithTTL(key, JSON.stringify(info), HEALTH_TTL);
    this.memoryFallback.set(moduleId, info);
  }

  private async loadHealth(moduleId: string): Promise<ModuleHealthInfo> {
    const key = `${HEALTH_PREFIX}${moduleId}`;
    const data = await get(key);
    if (data) {
      try {
        return JSON.parse(data) as ModuleHealthInfo;
      } catch {
        // Fallback на in-memory
      }
    }
    const fallback = this.memoryFallback.get(moduleId);
    if (fallback) return fallback;

    const defaultInfo: ModuleHealthInfo = {
      moduleId,
      status: "ONLINE",
      consecutiveFailures: 0,
    };
    return defaultInfo;
  }

  public async recordSuccess(moduleId: string) {
    await this.initModule(moduleId);
    const info = await this.loadHealth(moduleId);
    info.consecutiveFailures = 0;
    info.lastSuccessTime = new Date().toISOString();

    if (info.status !== "ONLINE") {
      info.status = "ONLINE";
      info.errorMessage = undefined;
      logEvent({
        level: "info",
        module: "SHELL_CIRCUIT_BREAKER",
        action: "MODULE_RESTORED",
        details: { moduleId, status: "ONLINE" },
      });
    }

    await this.saveHealth(moduleId, info);
  }

  public async recordFailure(moduleId: string, error?: string) {
    await this.initModule(moduleId);
    const info = await this.loadHealth(moduleId);
    info.consecutiveFailures += 1;
    info.lastFailureTime = new Date().toISOString();
    info.errorMessage = error;

    if (info.consecutiveFailures >= this.FAILURE_THRESHOLD && info.status === "ONLINE") {
      info.status = "DEGRADED";
      logEvent({
        level: "warn",
        module: "SHELL_CIRCUIT_BREAKER",
        action: "MODULE_DEGRADED",
        details: { moduleId, failures: info.consecutiveFailures, error },
      });
    }

    await this.saveHealth(moduleId, info);
  }

  public async getModuleHealth(moduleId: string): Promise<ModuleHealthInfo> {
    await this.initModule(moduleId);
    return await this.loadHealth(moduleId);
  }

  public async isModuleAvailable(moduleId: string): Promise<boolean> {
    const health = await this.getModuleHealth(moduleId);
    return health.status !== "OFFLINE";
  }

  /**
   * Сброс состояния модуля (для тестов)
   */
  public async resetModule(moduleId: string): Promise<void> {
    const key = `${HEALTH_PREFIX}${moduleId}`;
    await del(key);
    this.memoryFallback.delete(moduleId);
  }
}

export const ModuleCircuitBreaker = new ModuleCircuitBreakerManager();
