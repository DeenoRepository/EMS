type EpsRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  searchParams?: URLSearchParams;
};

export type EpsEquipment = {
  id: string;
  equipmentCode?: string;
  name: string;
  type?: string | null;
  category?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  inventoryNumber?: string | null;
  department?: string | null;
  location?: string | null;
  status?: string;
  lifecycleStage?: string;
};

function getBaseUrl() {
  const raw = process.env.EPS_API_BASE_URL || "";
  return raw.replace(/\/$/, "");
}

function getTimeoutMs() {
  const value = Number(process.env.EPS_API_TIMEOUT_MS || "10000");
  return Number.isFinite(value) && value > 0 ? value : 10000;
}

function buildHeaders() {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = process.env.EPS_API_TOKEN?.trim();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function requestEps<T>(path: string, options?: EpsRequestOptions): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error("EPS_API_BASE_URL is not configured");
  }

  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  if (options?.searchParams) {
    options.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const res = await fetch(url, {
      method: options?.method || "GET",
      headers: buildHeaders(),
      body: options?.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`EPS API ${res.status}: ${text || "request failed"}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchEquipmentList(params: { q?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  return requestEps<{ items: EpsEquipment[]; total: number; page: number; pageSize: number }>("/equipment", { searchParams: search });
}

export async function fetchEquipmentById(id: string) {
  return requestEps<EpsEquipment>(`/equipment/${id}`);
}

export async function checkEpsHealth() {
  try {
    const response = await requestEps<{ ok?: boolean }>("/health");
    return {
      ok: response.ok !== false,
      message: "healthy"
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "EPS integration failed"
    };
  }
}
