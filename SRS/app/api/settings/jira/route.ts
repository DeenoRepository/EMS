import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyRole } from "@/lib/auth/rbac";
import { addAudit } from "@/lib/srs/audit";
import { z } from "zod";

const schema = z.object({
  apiUrl: z.string().url(),
  username: z.string().min(1),
  jql: z.string().optional(),
  autoImportEnabled: z.boolean().default(false),
  autoImportPeriodMinutes: z.number().int().positive().optional(),
  filterIds: z.array(z.string()).default([]),
});

const testSchema = z.object({
  apiUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().optional(),
  token: z.string().optional(),
  jql: z.string().optional(),
  filterIds: z.array(z.string()).default([]),
});

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

function buildSearchJql(jql?: string, filterIds?: string[]) {
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

async function jiraPing(apiUrl: string, username: string, password: string, jql: string) {
  const url = buildJiraSearchUrl(apiUrl, jql, 0, 1, "key");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
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

  const data = (await res.json()) as { total?: number };
  return { total: data.total ?? 0 };
}

export async function GET(req: NextRequest) {
  try {
    await requireAnyRole(["ADMIN", "EDITOR"]);

    const settings = await prisma.jiraSettings.findUnique({ where: { id: 1 } });
    if (!settings) return NextResponse.json(null);

    return NextResponse.json({
      id: settings.id,
      apiUrl: settings.apiUrl,
      username: settings.username,
      jql: settings.jql,
      autoImportEnabled: settings.autoImportEnabled,
      autoImportPeriodMinutes: settings.autoImportPeriodMinutes,
      filterIds: settings.filterIds,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "settings load failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAnyRole(["ADMIN", "EDITOR"]);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const p = parsed.data;

    const settings = await prisma.jiraSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        apiUrl: p.apiUrl,
        username: p.username,
        tokenEncrypted: "",
        jql: p.jql,
        autoImportEnabled: p.autoImportEnabled,
        autoImportPeriodMinutes: p.autoImportPeriodMinutes,
        filterIds: p.filterIds,
      },
      update: {
        apiUrl: p.apiUrl,
        username: p.username,
        jql: p.jql,
        autoImportEnabled: p.autoImportEnabled,
        autoImportPeriodMinutes: p.autoImportPeriodMinutes,
        filterIds: p.filterIds,
      },
    });

    await addAudit(session.email, "update", "jira_settings", "1", {
      apiUrl: p.apiUrl,
      filterIds: p.filterIds,
      autoImportEnabled: p.autoImportEnabled,
    });

    return NextResponse.json({
      id: settings.id,
      apiUrl: settings.apiUrl,
      username: settings.username,
      jql: settings.jql,
      autoImportEnabled: settings.autoImportEnabled,
      autoImportPeriodMinutes: settings.autoImportPeriodMinutes,
      filterIds: settings.filterIds,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "settings save failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAnyRole(["ADMIN", "EDITOR"]);

  const parsed = testSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    const p = parsed.data;
    const password = p.password?.trim() || p.token?.trim();
    if (!password) return NextResponse.json({ error: "password is required" }, { status: 400 });
    const jql = buildSearchJql(p.jql, p.filterIds);
    const result = await jiraPing(p.apiUrl, p.username, password, jql);
    return NextResponse.json({
      connection: "ok",
      jql,
      foundIssues: result.total,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "jira connection failed" }, { status: 500 });
  }
}
