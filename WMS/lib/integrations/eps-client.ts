const EPS_API_BASE_URL = process.env.EPS_API_BASE_URL || "http://eps-service/api";

export async function checkEpsHealth() {
  const url = `${EPS_API_BASE_URL}/health`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    return {
      ok: res.ok,
      status: res.status,
      url
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      message: error instanceof Error ? error.message : "EPS unavailable"
    };
  }
}

async function requestJson(path: string) {
  const res = await fetch(`${EPS_API_BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`EPS request failed: ${res.status}`);
  return res.json();
}

export async function searchEpsEquipment(q: string) {
  const query = encodeURIComponent(q.trim());
  const candidates = [
    `/equipment?search=${query}&page=1&pageSize=20`,
    `/equipment?q=${query}&page=1&pageSize=20`,
    `/eps/equipment?search=${query}&page=1&pageSize=20`
  ];

  for (const path of candidates) {
    try {
      const data = await requestJson(path);
      const items = Array.isArray((data as any)?.items) ? (data as any).items : Array.isArray(data) ? data : [];
      return items;
    } catch {
      // try next candidate
    }
  }

  return [];
}
