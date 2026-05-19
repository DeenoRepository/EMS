export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { getSession, hasRole } from "@/lib/server/session";
import { issueSourceHash } from "@/lib/server/dedupe";
import { z } from "zod";
import { Prisma } from "@prisma/client";

type JiraIssue = { key: string; fields?: Record<string, any> };
const runSchema = z.object({ password: z.string().min(1) });

function describeFetchError(error: unknown) {
  if (!(error instanceof Error)) return "unknown fetch error";
  const anyErr = error as Error & { cause?: { code?: string; message?: string } };
  const code = anyErr.cause?.code ?? "";
  const causeMsg = anyErr.cause?.message ?? "";
  if (code === "ENOTFOUND") return "dns lookup failed (ENOTFOUND)";
  if (code === "ECONNREFUSED") return "connection refused (ECONNREFUSED)";
  if (code === "ETIMEDOUT") return "connection timeout (ETIMEDOUT)";
  if (code === "ECONNRESET") return "connection reset (ECONNRESET)";
  if (code === "DEPTH_ZERO_SELF_SIGNED_CERT" || code === "SELF_SIGNED_CERT_IN_CHAIN") return "tls certificate error";
  return `${error.message}${causeMsg ? ` | cause: ${causeMsg}` : ""}`;
}

function getFieldString(fields: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const v = fields[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      if (typeof v.value === "string" && v.value.trim()) return v.value.trim();
      if (typeof v.name === "string" && v.name.trim()) return v.name.trim();
      if (typeof v.displayName === "string" && v.displayName.trim()) return v.displayName.trim();
      if (typeof v.id === "string" && v.id.trim()) return v.id.trim();
    }
  }
  return undefined;
}

function buildSearchJql(jql?: string | null, filterIds?: string[]) {
  const cleanedIds = (filterIds ?? []).map((x) => x.trim()).filter(Boolean);
  const filterPart = cleanedIds.length > 0 ? `filter in (${cleanedIds.join(",")})` : "";
  const userPart = (jql ?? "").trim();

  if (filterPart && userPart) return `${filterPart} AND (${userPart})`;
  if (filterPart) return `${filterPart} ORDER BY created DESC`;
  if (userPart) return userPart;
  return "ORDER BY created DESC";
}

function buildJiraSearchUrl(apiUrl: string, jql: string, startAt: number, maxResults: number, fields: string) {
  const clean = apiUrl.replace(/\/$/, "");
  const base = /\/rest\/api\/2\/search$/i.test(clean) ? clean : `${clean}/rest/api/2/search`;
  return `${base}?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=${encodeURIComponent(fields)}`;
}

async function loadJiraIssues(apiUrl: string, username: string, password: string, jql: string, startAt: number) {
  const url = buildJiraSearchUrl(
    apiUrl,
    jql,
    startAt,
    100,
    "summary,description,created,resolutiondate,status,reporter,assignee,comment,customfield_10501,customfield_10502,customfield_10519,customfield_10524,customfield_10000"
  );
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(`jira fetch failed: ${describeFetchError(error)}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`jira request failed: ${res.status} ${body.slice(0, 240)}`);
  }
  return res.json() as Promise<{ issues: JiraIssue[]; total: number }>;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session.roles, ["ADMIN", "ANALYST"])) return fail("forbidden", 403);

  const runs = await prisma.importRun.findMany({
    where: { sourceType: "JIRA" },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return ok(
    runs.map((r) => ({
      id: r.id.toString(),
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      itemsTotal: r.itemsTotal,
      itemsLoaded: r.itemsLoaded,
      errorText: r.errorText,
      initiatedBy: r.initiatedBy,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !hasRole(session.roles, ["ADMIN", "ANALYST"])) return fail("forbidden", 403);

  const settings = await prisma.jiraSettings.findUnique({ where: { id: 1 } });
  if (!settings) return fail("jira settings not configured", 400);
  const parsed = runSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("password is required", 400);

  const run = await prisma.importRun.create({
    data: { sourceType: "JIRA", status: "RUNNING", initiatedBy: session.login },
  });

  try {
    const password = parsed.data.password;
    const jql = buildSearchJql(settings.jql, settings.filterIds);
    const collected: JiraIssue[] = [];

    for (let offset = 0; offset < 10000; offset += 100) {
      const page = await loadJiraIssues(settings.apiUrl, settings.username, password, jql, offset);
      collected.push(...page.issues);
      if (collected.length >= page.total || page.issues.length === 0) break;
    }

    let loaded = 0;
    for (const item of collected) {
      const fields = item.fields ?? {};

      const equipmentUid = getFieldString(fields, ["customfield_10524", "customfield_10000"]) ?? "unknown";
      const equipmentTitle = getFieldString(fields, ["customfield_10519", "summary"]) ?? "Unknown equipment";
      const status = getFieldString(fields, ["status"]) ?? "Unknown";
      const created = new Date(getFieldString(fields, ["created"]) ?? new Date().toISOString());
      const resolvedRaw = getFieldString(fields, ["resolutiondate"]);
      const resolved = resolvedRaw ? new Date(resolvedRaw) : null;
      const responsible = getFieldString(fields, ["assignee"]);
      const reporter = getFieldString(fields, ["reporter"]);
      const type = getFieldString(fields, ["customfield_10501", "customfield_10502"]) ?? "failure";
      const commentsArray = fields.comment?.comments as Array<{ body?: string }> | undefined;
      const comments = commentsArray?.map((c) => c.body).filter(Boolean).join("\n") || undefined;

      const equipment = await prisma.equipment.upsert({
        where: { uid: equipmentUid },
        update: { title: equipmentTitle },
        create: { uid: equipmentUid, title: equipmentTitle },
      });

      const sourceHash = issueSourceHash({
        jiraIssueKey: item.key,
        equipmentUid,
        startAt: created.toISOString(),
        type,
        responsible,
        description: String(fields.summary ?? ""),
      });

      try {
        await prisma.issue.create({
          data: {
            equipmentId: equipment.id,
            jiraIssueKey: item.key,
            startAt: created,
            endAt: resolved,
            type,
            status,
            responsible,
            reporter,
            description: String(fields.summary ?? ""),
            comments,
            isInProgress: status.toLowerCase() === "in progress" || status.toLowerCase() === "в процессе",
            source: "JIRA",
            sourceHash,
          },
        });
        loaded += 1;
      } catch (error) {
        // Unique constraint on sourceHash means this issue is already imported.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
          throw error;
        }
      }
    }

    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        itemsTotal: collected.length,
        itemsLoaded: loaded,
        finishedAt: new Date(),
      },
    });

    return ok({
      importRunId: run.id.toString(),
      itemsTotal: collected.length,
      itemsLoaded: loaded,
      jql,
    });
  } catch (e) {
    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorText: e instanceof Error ? e.message : "unknown error",
      },
    });
    return fail(e instanceof Error ? e.message : "jira import failed", 500);
  }
}
