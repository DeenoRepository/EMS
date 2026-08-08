import { logEvent } from "@/lib/telemetry/logger";

export type ModuleHealthStatus = "ONLINE" | "DEGRADED" | "OFFLINE";

export interface ModuleHealthInfo {
  moduleId: string;
  status: ModuleHealthStatus;
  consecutiveFailures: number;
  lastFailureTime?: string;
  lastSuccessTime?: string;
  errorMessage?: string;
}

class ModuleCircuitBreakerManager {
  private healthMap: Map<string, ModuleHealthInfo> = new Map();
  private readonly FAILURE_THRESHOLD = 3;

  constructor() {
    // Инициализация базовых модулей
    this.initModule("eps");
    this.initModule("wms");
  }

  private initModule(moduleId: string) {
    if (!this.healthMap.has(moduleId)) {
      this.healthMap.set(moduleId, {
        moduleId,
        status: "ONLINE",
        consecutiveFailures: 0,
      });
    }
  }

  public recordSuccess(moduleId: string) {
    this.initModule(moduleId);
    const info = this.healthMap.get(moduleId)!;
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
  }

  public recordFailure(moduleId: string, error?: string) {
    this.initModule(moduleId);
    const info = this.healthMap.get(moduleId)!;
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
  }

  public getModuleHealth(moduleId: string): ModuleHealthInfo {
    this.initModule(moduleId);
    return this.healthMap.get(moduleId)!;
  }

  public isModuleAvailable(moduleId: string): boolean {
    const health = this.getModuleHealth(moduleId);
    return health.status !== "OFFLINE";
  }
}

export const ModuleCircuitBreaker = new ModuleCircuitBreakerManager();
