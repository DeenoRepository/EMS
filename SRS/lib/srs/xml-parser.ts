import { XMLParser } from "fast-xml-parser";

export type ParsedXmlEvent = {
  equipmentUid: string;
  equipmentTitle: string;
  inventoryNumber?: string;
  subdivision?: string;
  jiraIssueKey?: string;
  startAt: Date;
  endAt?: Date;
  type: string;
  status: string;
  responsible?: string;
  reporter?: string;
  description?: string;
  comments?: string;
  isInProgress: boolean;
};

const STATUS_IN_PROGRESS = ["in progress", "в работе", "в процессе"];

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseDate(v: unknown): Date | null {
  const t = asText(v);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseXmlEvents(xml: string): ParsedXmlEvent[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true
  });

  const doc = parser.parse(xml) as any;
  const roots = [doc?.events?.event, doc?.event, doc?.items?.item, doc?.issues?.issue, doc?.feed?.entry];
  const eventsRaw = roots.flatMap((x) => toArray(x)).filter(Boolean);

  const mapped: Array<ParsedXmlEvent | null> = eventsRaw.map((item: any) => {
      const equipmentUid = asText(item.equipmentUid ?? item.equipment_id ?? item.uid ?? item.equipment?.uid);
      const equipmentTitle = asText(item.equipmentTitle ?? item.equipment_title ?? item.title ?? item.equipment?.title);
      const startAt = parseDate(item.startAt ?? item.start_at ?? item.dateStart ?? item.created ?? item.date);
      if (!equipmentUid || !equipmentTitle || !startAt) return null;

      const status = asText(item.status ?? item.state ?? "Unknown");
      return {
        equipmentUid,
        equipmentTitle,
        inventoryNumber: asText(item.inventoryNumber ?? item.inventory_number) || undefined,
        subdivision: asText(item.subdivision ?? item.group) || undefined,
        jiraIssueKey: asText(item.jiraIssueKey ?? item.jira_key ?? item.key) || undefined,
        startAt,
        endAt: parseDate(item.endAt ?? item.end_at ?? item.dateEnd ?? item.resolved) ?? undefined,
        type: asText(item.type ?? item.event_type ?? "failure") || "failure",
        status,
        responsible: asText(item.responsible ?? item.assignee ?? item.owner) || undefined,
        reporter: asText(item.reporter ?? item.author) || undefined,
        description: asText(item.description ?? item.summary) || undefined,
        comments: asText(item.comments ?? item.comment) || undefined,
        isInProgress: STATUS_IN_PROGRESS.includes(status.toLowerCase())
      };
  });

  return mapped.filter((x): x is ParsedXmlEvent => x !== null);
}
