/**
 * System Event Bus (SEC-03)
 *
 * Шина событий с поддержкой Redis Pub/Sub для работы в multi-instance окружениях.
 * В development/test fallback на in-process EventEmitter.
 */
import { EventEmitter } from "events";
import { logEvent } from "@/lib/telemetry/logger";
import { getRedis } from "@/lib/db/redis";

export interface SystemEventPayload {
  eventId: string;
  eventType: string;
  module: "eps" | "wms" | "toir" | "system" | string;
  actorId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export type EventCallback = (payload: SystemEventPayload) => Promise<void> | void;

const REDIS_CHANNEL = "ems:events";

class SystemEventBus extends EventEmitter {
  private static instance: SystemEventBus;
  private redisSubscriber: ReturnType<typeof getRedis> | null = null;
  private isRedisSubscribed = false;

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
   * Инициализирует Redis subscriber для получения событий от других инстансов
   */
  private async ensureRedisSubscriber(): Promise<void> {
    if (this.isRedisSubscribed) return;

    const redis = getRedis();
    if (!redis) return;

    try {
      // Создаём отдельное подключение для подписки (требование ioredis)
      const subscriber = redis.duplicate();
      await subscriber.subscribe(REDIS_CHANNEL);

      subscriber.on("message", (channel: string, message: string) => {
        if (channel !== REDIS_CHANNEL) return;
        try {
          const payload = JSON.parse(message) as SystemEventPayload;
          // Доставляем событие локальным подписчикам
          this.emit(payload.eventType, payload);
          this.emit("*", payload);
        } catch (err) {
          console.error("[EventBus] Failed to parse Redis message:", err);
        }
      });

      this.redisSubscriber = subscriber;
      this.isRedisSubscribed = true;
      console.log("[EventBus] Redis subscriber initialized");
    } catch (err) {
      console.error("[EventBus] Failed to initialize Redis subscriber:", err);
    }
  }

  /**
   * Публикует событие в шину
   *
   * В multi-instance режиме событие публикуется в Redis Pub/Sub,
   * откуда его получают все инстансы приложения.
   */
  public async publish(
    module: string,
    eventType: string,
    data: Record<string, unknown>,
    actorId?: string
  ): Promise<SystemEventPayload> {
    const payload: SystemEventPayload = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      module,
      actorId,
      timestamp: new Date().toISOString(),
      data,
    };

    logEvent({
      level: "info",
      module: `EVENT_BUS:${module.toUpperCase()}`,
      action: eventType,
      userId: actorId,
      details: payload as unknown as Record<string, unknown>,
    });

    // Инициализируем subscriber при первой публикации
    await this.ensureRedisSubscriber();

    // Публикуем в Redis (если доступен) — событие получат все инстансы
    const redis = getRedis();
    if (redis) {
      try {
        await redis.publish(REDIS_CHANNEL, JSON.stringify(payload));
        // Не делаем локальный emit — Redis subscriber доставит событие обратно
        // через this.emit, что обеспечивает единый путь обработки
      } catch (err) {
        console.error("[EventBus] Failed to publish to Redis, falling back to local:", err);
        // Fallback на локальный emit
        this.emit(eventType, payload);
        this.emit("*", payload);
      }
    } else {
      // In-process режим (development без Redis)
      this.emit(eventType, payload);
      this.emit("*", payload);
    }

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

    // Инициализируем Redis subscriber при первой подписке
    void this.ensureRedisSubscriber();
  }

  /**
   * Закрыть Redis subscriber (для graceful shutdown)
   */
  public async shutdown(): Promise<void> {
    if (this.redisSubscriber) {
      try {
        await this.redisSubscriber.quit();
      } catch {
        // ignore
      }
      this.redisSubscriber = null;
      this.isRedisSubscribed = false;
    }
  }
}

export const eventBus = SystemEventBus.getInstance();

// Пример подписки WMS на события декоммиссии оборудования в EPS
eventBus.subscribe("EQUIPMENT_DECOMMISSIONED", async (event) => {
  console.info(
    `[WMS System Reactor] Оборудование ${event.data.equipmentCode} списано. Проверка связанных ТМЦ и резервов...`
  );
});
