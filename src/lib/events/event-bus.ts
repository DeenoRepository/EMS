import { EventEmitter } from "events";
import { logEvent } from "@/lib/telemetry/logger";

export interface SystemEventPayload {
  eventId: string;
  eventType: string;
  module: "eps" | "wms" | "toir" | "system" | string;
  actorId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export type EventCallback = (payload: SystemEventPayload) => Promise<void> | void;

class SystemEventBus extends EventEmitter {
  private static instance: SystemEventBus;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): SystemEventBus {
    if (!SystemEventBus.instance) {
      SystemEventBus.instance = new SystemEventBus();
    }
    return SystemEventBus.instance;
  }

  /**
   * Публикует событие в шину
   */
  public publish(module: string, eventType: string, data: Record<string, unknown>, actorId?: string): SystemEventPayload {
    const payload: SystemEventPayload = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      module,
      actorId,
      timestamp: new Date().toISOString(),
      data
    };

    logEvent({
      level: "info",
      module: `EVENT_BUS:${module.toUpperCase()}`,
      action: eventType,
      userId: actorId,
      details: payload as unknown as Record<string, unknown>
    });

    this.emit(eventType, payload);
    this.emit("*", payload);

    return payload;
  }

  /**
   * Подписывается на событие
   */
  public subscribe(eventType: string, callback: EventCallback): void {
    this.on(eventType, async (payload: SystemEventPayload) => {
      try {
        await callback(payload);
      } catch (err) {
        console.error(`[EventBus Handler Error] Failed processing ${eventType}:`, err);
      }
    });
  }
}

export const eventBus = SystemEventBus.getInstance();

// Пример подписки WMS на события декоммиссии оборудования в EPS
eventBus.subscribe("EQUIPMENT_DECOMMISSIONED", async (event) => {
  console.info(`[WMS System Reactor] Оборудование ${event.data.equipmentCode} списано. Проверка связанных ТМЦ и резервов...`);
});
