import { readFile } from "node:fs/promises";
import path from "node:path";

type JiraIssue = {
  id: string;
  key: string;
  fields?: {
    created?: string;
    resolutiondate?: string;
    summary?: string;
    description?: string;
    customfield_10500?: { value?: string } | string;
    customfield_10501?: { value?: string } | string;
    customfield_10519?: { value?: string } | string;
    customfield_10524?: { value?: string } | string;
    status?: { name?: string; statusCategory?: { key?: string } };
    assignee?: { displayName?: string } | null;
    reporter?: { displayName?: string } | null;
    project?: { name?: string };
    comment?: { comments?: Array<{ body?: string }> };
  };
};

export type MockIssue = {
  id: string;
  equipmentUid: string;
  equipmentTitle: string;
  factoryNumber: string;
  startAt: Date;
  endAt: Date | null;
  type: string;
  status: string;
  responsible: string;
  subdivision: string;
  jiraIssueKey: string;
  description: string;
  comments: string;
  isInProgress: boolean;
};

const DEFAULT_MOCK_PATH = path.join(process.cwd(), "data", "mock-jira.json");
const APP_TZ = process.env.APP_TIMEZONE || "Asia/Novosibirsk";
let cache: MockIssue[] | null = null;

function dateKeyInTz(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function fieldText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "value" in value) {
    const v = (value as { value?: unknown }).value;
    return typeof v === "string" ? v : "";
  }
  return "";
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (!value) return out;
  if (typeof value === "string") {
    const v = value.trim();
    if (v) out.push(v);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "self" || k === "id" || k === "key") continue;
      collectStrings(v, out);
    }
  }
  return out;
}

function isServiceRequestText(text: string) {
  return /сервисн\w*\s+запрос|service\s+request/i.test(text);
}

function isGenericProblemText(text: string) {
  return /^(проблема|problem|инцидент|incident|заявка|request)(\s*\(.*\))?$/i.test(text.trim());
}

function isBadEquipmentText(text: string) {
  const t = text.trim();
  return !t || isServiceRequestText(t) || isGenericProblemText(t);
}

function normalizeEquipmentTitle(title: string) {
  return title
    .replace(/^\s*(сервисн\w*\s+запрос|service\s+request)\s*[:\-–—]?\s*/i, "")
    .replace(/^\s*(проблема|problem|инцидент|incident|заявка|request)\s*[:\-–—]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEquipment(raw: string, summary?: string) {
  const normalized = raw.replace(/\s+/g, " ").trim();
  const firstSegment = normalized.split("\t")[0]?.trim() ?? normalized;

  const nums = Array.from(normalized.matchAll(/\b\d{4,}\b/g)).map((m) => m[0]);
  const equipmentUid = nums.at(-1) ?? "N/A";
  const factoryNumber = nums.length > 1 ? nums.at(-2) ?? "" : "";

  let title = firstSegment;
  if (equipmentUid && equipmentUid !== "N/A") {
    title = title.replace(new RegExp(`\\s*${equipmentUid}\\s*$`), "").trim();
  }

  let fallbackTitle = normalizeEquipmentTitle((summary ?? "").trim());
  if (!fallbackTitle || isBadEquipmentText(fallbackTitle)) fallbackTitle = "Не указано";
  return {
    equipmentUid,
    equipmentTitle: (isBadEquipmentText(normalizeEquipmentTitle(title)) ? "" : normalizeEquipmentTitle(title)) || fallbackTitle,
    factoryNumber: factoryNumber || "Не указан",
  };
}

function applyFilters(items: MockIssue[], params: URLSearchParams) {
  const from = params.get("from");
  const to = params.get("to");
  const status = params.get("status")?.toLowerCase() ?? "";
  const type = params.get("type")?.toLowerCase() ?? "";
  const responsible = params.get("responsible")?.toLowerCase() ?? "";
  const subdivision = params.get("subdivision")?.toLowerCase() ?? "";
  const equipment = params.get("equipment")?.toLowerCase() ?? "";

  return items.filter((x) => {
    const dayKey = dateKeyInTz(x.startAt);
    if (from && dayKey < from) return false;
    if (to && dayKey > to) return false;
    if (status && !x.status.toLowerCase().includes(status)) return false;
    if (type && !x.type.toLowerCase().includes(type)) return false;
    if (responsible && !x.responsible.toLowerCase().includes(responsible)) return false;
    if (subdivision && !x.subdivision.toLowerCase().includes(subdivision)) return false;
    if (equipment) {
      const candidate = `${x.equipmentUid} ${x.equipmentTitle}`.toLowerCase();
      if (!candidate.includes(equipment)) return false;
    }
    return true;
  });
}

export async function getMockIssues() {
  if (cache) return cache;

  const raw = await readFile(process.env.MOCK_JIRA_PATH || DEFAULT_MOCK_PATH, "utf8");
  const parsed = JSON.parse(raw) as { issues?: JiraIssue[] };
  const issues = parsed.issues ?? [];

  cache = issues.map((issue) => {
    const fields = issue.fields ?? {};
    const equipmentCandidates = [
      ...collectStrings(fields.customfield_10500),
      ...collectStrings(fields.customfield_10524),
      ...collectStrings(fields.customfield_10519),
    ]
      .map((x) => x.trim())
      .filter((x) => x.length > 0)
      .filter((x) => !isBadEquipmentText(x))
      .sort((a, b) => {
        const score = (s: string) => {
          let v = 0;
          if (/\d{3,}/.test(s)) v += 3;
          if (/инв|зав|установка|комплекс|устройство|камера|станок|линия|class|unit/i.test(s)) v += 2;
          if (s.length >= 12) v += 1;
          return v;
        };
        return score(b) - score(a);
      });
    const equipmentRaw = equipmentCandidates[0] || fields.summary || "";
    const equipment = parseEquipment(equipmentRaw, fields.summary);
    const comments = (fields.comment?.comments ?? []).map((x) => x.body ?? "").filter(Boolean).join("\n");
    const status = fields.status?.name || "Unknown";
    const statusCategory = fields.status?.statusCategory?.key || "";
    const endAt = fields.resolutiondate ? new Date(fields.resolutiondate) : null;

    return {
      id: issue.id,
      equipmentUid: equipment.equipmentUid,
      equipmentTitle: equipment.equipmentTitle,
      factoryNumber: equipment.factoryNumber,
      startAt: fields.created ? new Date(fields.created) : new Date(),
      endAt,
      type: fieldText(fields.customfield_10501) || "Failure",
      status,
      responsible: fields.assignee?.displayName || fields.reporter?.displayName || "",
      subdivision: fields.project?.name || "",
      jiraIssueKey: issue.key,
      description: fields.description || fields.summary || "",
      comments,
      isInProgress: !endAt || statusCategory !== "done",
    } satisfies MockIssue;
  });

  return cache;
}

export async function getFilteredMockIssues(params: URLSearchParams) {
  const items = await getMockIssues();
  return applyFilters(items, params);
}
