type WmsRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  searchParams?: URLSearchParams;
};
import http from "node:http";
import https from "node:https";

type WmsReservationItem = {
  sku: string;
  quantity: number;
  note?: string;
};

export type WmsAvailabilityItem = {
  sku: string;
  requested: number;
  available: number;
  status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
};

function getBaseUrl() {
  const raw = process.env.WMS_API_BASE_URL || "";
  return raw.replace(/\/$/, "");
}

function getPath(name: "health" | "availability" | "reservations") {
  if (name === "health") return process.env.WMS_HEALTH_PATH || "/api/health";
  if (name === "availability") return process.env.WMS_AVAILABILITY_PATH || "/api/wms/availability";
  return process.env.WMS_RESERVATIONS_PATH || "/api/wms/reservations";
}

function getTimeoutMs() {
  const value = Number(process.env.WMS_API_TIMEOUT_MS || "10000");
  return Number.isFinite(value) && value > 0 ? value : 10000;
}

function buildHeaders() {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = process.env.WMS_API_TOKEN?.trim();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function requestWms<T>(path: string, options?: WmsRequestOptions): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error("WMS_API_BASE_URL is not configured");

  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  if (options?.searchParams) {
    options.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }

  const body = options?.body ? JSON.stringify(options.body) : undefined;
  const headers = buildHeaders();
  if (body) headers.set("Content-Length", String(Buffer.byteLength(body)));

  const transport = url.protocol === "https:" ? https : http;

  return new Promise<T>((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: options?.method || "GET",
        headers: Object.fromEntries(headers.entries()),
        timeout: getTimeoutMs()
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode || 0;
          if (status < 200 || status >= 300) {
            reject(new Error(`WMS API ${status}: ${text || "request failed"}`));
            return;
          }
          try {
            resolve((text ? JSON.parse(text) : {}) as T);
          } catch {
            reject(new Error("WMS API invalid JSON response"));
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("WMS API timeout"));
    });
    req.on("error", (error) => reject(error));
    if (body) req.write(body);
    req.end();
  });
}

export async function fetchWmsAvailability(equipmentId: string, items: Array<{ sku: string; quantity: number }>) {
  return requestWms<{ ok: boolean; items: WmsAvailabilityItem[] }>(getPath("availability"), {
    method: "POST",
    body: { equipmentId, items }
  });
}

export async function createWmsReservation(params: {
  equipmentId: string;
  items: WmsReservationItem[];
  taskId?: string;
  workOrderId?: string;
}) {
  return requestWms<{ ok: boolean; reservationId: string; status: string; payload?: unknown }>(getPath("reservations"), {
    method: "POST",
    body: params
  });
}

export async function checkWmsHealth() {
  try {
    const response = await requestWms<{ ok?: boolean }>(getPath("health"));
    return {
      ok: response.ok !== false,
      message: "healthy"
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "WMS integration failed"
    };
  }
}
