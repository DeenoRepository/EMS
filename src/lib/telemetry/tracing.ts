/**
 * Distributed Tracing с OpenTelemetry (MONITOR-02)
 *
 * Обеспечивает трейсинг запросов между модулями и сервисами.
 * Поддерживает экспорт в Jaeger, Tempo, Zipkin.
 *
 * Использование:
 *   import { tracer, withSpan } from "@/lib/telemetry/tracing";
 *
 *   await withSpan("operation-name", async (span) => {
 *     span.setAttribute("key", "value");
 *     // ... business logic
 *   });
 */
import { trace, context, SpanStatusCode, SpanKind } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { APP_VERSION } from "@/lib/version";

/**
 * Инициализация OpenTelemetry
 *
 * В production подключается к OTLP endpoint (Jaeger/Tempo).
 * В development выводит спаны в консоль.
 */
let initialized = false;

export function initTracing(): void {
    if (initialized) return;
    initialized = true;

    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const serviceName = process.env.OTEL_SERVICE_NAME || "ems-app";
    const environment = process.env.NODE_ENV || "development";

    const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: APP_VERSION,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
    });

    const provider = new NodeTracerProvider({ resource });

    if (otlpEndpoint) {
        // Production: экспорт в OTLP endpoint
        const exporter = new OTLPTraceExporter({
            url: `${otlpEndpoint}/v1/traces`,
        });
        provider.addSpanProcessor(new BatchSpanProcessor(exporter));
    } else if (environment === "development") {
        // Development: вывод в консоль
        provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));
    }

    provider.register();

    console.log(`[Tracing] Initialized for ${serviceName} v${APP_VERSION} (${environment})`);
}

/**
 * Получить текущий tracer
 */
export function getTracer(name = "ems") {
    return trace.getTracer(name);
}

/**
 * Выполнить функцию внутри span
 *
 * @param name - имя операции
 * @param fn - функция для выполнения
 * @param attributes - дополнительные атрибуты спана
 */
export async function withSpan<T>(
    name: string,
    fn: (span: ReturnType<typeof getTracer>["startSpan"] extends (...args: any[]) => infer R ? R : never) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
): Promise<T> {
    const tracer = getTracer();
    const span = tracer.startSpan(name, {
        kind: SpanKind.INTERNAL,
        attributes,
    });

    try {
        const result = await context.with(trace.setSpan(context.active(), span), () =>
            fn(span as any)
        );
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
    } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (err as Error).message,
        });
        throw err;
    } finally {
        span.end();
    }
}

/**
 * Добавить атрибут к текущему активному спану
 */
export function setSpanAttribute(key: string, value: string | number | boolean): void {
    const span = trace.getActiveSpan();
    if (span) {
        span.setAttribute(key, value);
    }
}

/**
 * Добавить событие к текущему активному спану
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
        span.addEvent(name, attributes);
    }
}

/**
 * Записать исключение в текущий активный спан
 */
export function recordSpanException(err: Error): void {
    const span = trace.getActiveSpan();
    if (span) {
        span.recordException(err);
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err.message,
        });
    }
}

/**
 * Создать child span для внешнего вызова
 */
export function startExternalSpan(
    name: string,
    target: string,
    attributes?: Record<string, string | number | boolean>
) {
    const tracer = getTracer();
    return tracer.startSpan(name, {
        kind: SpanKind.CLIENT,
        attributes: {
            "peer.address": target,
            ...attributes,
        },
    });
}

/**
 * Обёртка для HTTP запросов с автоматическим трейсингом
 */
export async function tracedFetch(
    url: string,
    options?: RequestInit & { spanName?: string }
): Promise<Response> {
    const tracer = getTracer();
    const span = tracer.startSpan(options?.spanName || `HTTP ${options?.method || "GET"}`, {
        kind: SpanKind.CLIENT,
        attributes: {
            "http.url": url,
            "http.method": options?.method || "GET",
        },
    });

    try {
        const response = await context.with(trace.setSpan(context.active(), span), () =>
            fetch(url, options)
        );

        span.setAttribute("http.status_code", response.status);

        if (!response.ok) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: `HTTP ${response.status}`,
            });
        } else {
            span.setStatus({ code: SpanStatusCode.OK });
        }

        return response;
    } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (err as Error).message,
        });
        throw err;
    } finally {
        span.end();
    }
}

// Экспортируем tracer для прямого использования
export const tracer = trace;
