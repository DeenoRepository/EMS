import { logEvent } from "@/lib/telemetry/logger";

export interface ShellEvent<T = Record<string, unknown>> {
  id: string;
  name: string; // E.g., 'eps.equipment.created', 'wms.stock.reserved'
  sourceModule: string; // E.g., 'eps', 'wms', 'shell'
  payload: T;
  timestamp: string;
  correlationId?: string;
}

export type EventHandler<T = Record<string, unknown>> = (event: ShellEvent<T>) => Promise<void> | void;

class ShellEventBusManager {
  private handlers: Map<string, EventHandler<any>[]> = new Map();
  private sseClients: Set<(event: ShellEvent) => void> = new Set();

  /**
   * Регистрация клиента SSE (Server-Sent Events)
   */
  public addSseClient(clientFn: (event: ShellEvent) => void): () => void {
    this.sseClients.add(clientFn);
    return () => {
      this.sseClients.delete(clientFn);
    };
  }

  /**
   * Подписка на доменное событие платформы
   */
  public subscribe<T = Record<string, unknown>>(eventName: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    const list = this.handlers.get(eventName)!;
    list.push(handler);

    // Возвращаем функцию отписки
    return () => {
      const index = list.indexOf(handler);
      if (index !== -1) {
        list.splice(index, 1);
      }
    };
  }

  /**
   * Публикация доменного события
   */
  public async publish<T = Record<string, unknown>>(
    eventName: string,
    sourceModule: string,
    payload: T,
    correlationId?: string
  ): Promise<ShellEvent<T>> {
    const event: ShellEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: eventName,
      sourceModule,
      payload,
      timestamp: new Date().toISOString(),
      correlationId: correlationId || `corr_${Date.now()}`,
    };

    // Логируем событие через системную телеметрию Shell
    logEvent({
      level: "info",
      module: sourceModule.toUpperCase(),
      action: `EVENT_PUBLISHED:${eventName}`,
      details: {
        eventId: event.id,
        correlationId: event.correlationId,
        payload,
      },
    });

    // Оповещаем зарегистрированные SSE подключения в браузере
    this.sseClients.forEach((clientFn) => {
      try {
        clientFn(event as ShellEvent);
      } catch (err) {
        console.error("[ShellEventBus] Error pushing to SSE client:", err);
      }
    });

    const eventHandlers = this.handlers.get(eventName) || [];
    const wildcardHandlers = this.handlers.get("*") || [];

    const allHandlers = [...eventHandlers, ...wildcardHandlers];

    // Выполняем обработчики асинхронно с защитой от падения основного потока
    const promises = allHandlers.map(async (handler) => {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[ShellEventBus] Error handling event ${eventName}:`, err);
        logEvent({
          level: "error",
          module: "SHELL_EVENT_BUS",
          action: `HANDLER_ERROR:${eventName}`,
          details: { error: String(err), eventId: event.id },
        });
      }
    });

    await Promise.allSettled(promises);
    return event;
  }
}

export const ShellEventBus = new ShellEventBusManager();

