import { log } from "@/lib/observability/logger";

const MMS_API_BASE_URL = process.env.MMS_API_BASE_URL || "http://mms-service/api";
const MMS_TIMEOUT_MS = Number(process.env.MMS_TIMEOUT_MS || "5000");
const MMS_RETRIES = Number(process.env.MMS_RETRIES || "2");
const RETRY_DELAY_MS = Number(process.env.MMS_RETRY_DELAY_MS || "300");
const WMS_WEBHOOK_TOKEN = process.env.WMS_WEBHOOK_TOKEN || "";

function getMmsRootUrl() {
  if (MMS_API_BASE_URL.endsWith("/api")) {
    return MMS_API_BASE_URL.slice(0, -4);
  }
  return MMS_API_BASE_URL.replace(/\/$/, "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(path: string, init?: RequestInit) {
  const url = `${MMS_API_BASE_URL}${path}`;
  const method = (init?.method || "GET").toUpperCase();

  for (let attempt = 0; attempt <= MMS_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MMS_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {})
        },
        cache: "no-store",
        signal: controller.signal
      });

      const body = await res.text();
      let parsed: unknown = null;
      try {
        parsed = body ? JSON.parse(body) : null;
      } catch {
        parsed = body;
      }

      if (!res.ok) {
        const error = new Error(`MMS API request failed: ${res.status}`);
        (error as any).meta = { status: res.status, body: parsed, url };
        throw error;
      }

      return parsed;
    } catch (error) {
      const status = Number((error as any)?.meta?.status || 0);
      const isTimeout = error instanceof Error && error.name === "AbortError";
      const transient = isTimeout || status >= 500 || status === 429 || status === 0;
      const canRetry = attempt < MMS_RETRIES && (method === "GET" || method === "POST") && transient;
      if (!canRetry) throw error;

      log.warn("mms_request_retry", {
        path,
        method,
        attempt: attempt + 1,
        status,
        timeout: isTimeout
      });
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("MMS API request failed: retries exhausted");
}

export const mmsApiClient = {
  async searchWorkOrders(q: string) {
    return requestJson(`/maintenance/work-orders?search=${encodeURIComponent(q)}`);
  },

  async searchRequiredParts(workOrderId: string, q: string) {
    return requestJson(`/maintenance/work-orders/${workOrderId}/required-parts?search=${encodeURIComponent(q)}`);
  },

  async getWorkOrder(id: string) {
    return requestJson(`/maintenance/work-orders/${id}`);
  },

  async getRequiredPart(workOrderId: string, partId: string) {
    return requestJson(`/maintenance/work-orders/${workOrderId}/required-parts/${partId}`);
  },

  async updateRequiredPartStatus(partId: string, status: string) {
    return requestJson(`/maintenance/required-parts/${partId}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });
  },

  async tryUpdateRequiredPartStatus(partId: string, status: string) {
    try {
      await this.updateRequiredPartStatus(partId, status);
      return { ok: true as const };
    } catch (error) {
      log.warn("mms_sync_failed", {
        partId,
        status,
        error: error instanceof Error ? error.message : "unknown"
      });
      return {
        ok: false as const,
        warning: "mms_sync_warning"
      };
    }
  },

  async sendWmsWebhook(payload: { reservationId: string; status: string; source?: string }) {
    const root = getMmsRootUrl();
    const endpoint = `${root}/api/integrations/wms/webhook`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (WMS_WEBHOOK_TOKEN.trim()) {
      headers["x-webhook-token"] = WMS_WEBHOOK_TOKEN.trim();
    }

    return requestJson(endpoint.replace(root, ""), {
      method: "POST",
      headers,
      body: JSON.stringify({
        reservationId: payload.reservationId,
        status: payload.status,
        source: payload.source || "wms"
      })
    });
  },

  async trySendWmsWebhook(payload: { reservationId: string; status: string; source?: string }) {
    try {
      await this.sendWmsWebhook(payload);
      return { ok: true as const };
    } catch (error) {
      log.warn("mms_wms_webhook_failed", {
        reservationId: payload.reservationId,
        status: payload.status,
        error: error instanceof Error ? error.message : "unknown"
      });
      return {
        ok: false as const,
        warning: "mms_webhook_warning"
      };
    }
  }
};
