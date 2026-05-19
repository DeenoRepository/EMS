import { Client } from "ldapts";
import { createSessionToken, sessionCookieHeader } from "@/lib/server/auth";
import { NextResponse } from "next/server";

const LDAP_CONFIG = {
  url: process.env.LDAP_URL || "ldap://ldap:389",
  bindDn: process.env.LDAP_BIND_DN || "cn=admin,dc=ems,dc=local",
  bindPassword: process.env.LDAP_BIND_PASSWORD || "admin",
  baseDn: process.env.LDAP_BASE_DN || "dc=ems,dc=local",
  userBaseDn: process.env.LDAP_USER_BASE_DN || "ou=people,dc=ems,dc=local",
  groupBaseDn: process.env.LDAP_GROUP_BASE_DN || "ou=groups,dc=ems,dc=local",
};

function escapeFilter(value: string) {
  return value.replace(/[\\()*\0]/g, (char) => {
    const map: Record<string, string> = { "\\": "\\5c", "*": "\\2a", "(": "\\28", ")": "\\29", "\0": "\\00" };
    return map[char] || char;
  });
}

function getAttr(entry: Record<string, unknown>, key: string) {
  const raw = entry[key];
  if (Array.isArray(raw)) return raw[0] ? String(raw[0]) : "";
  return raw ? String(raw) : "";
}

function getAttrArray(entry: Record<string, unknown>, key: string) {
  const raw = entry[key];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((item) => String(item));
  return [String(raw)];
}

function extractGroupNamesFromMemberOf(rawValues: string[]) {
  return rawValues
    .map((value) => {
      const match = value.match(/(?:^|,)cn=([^,]+)/i);
      return match?.[1] || value;
    })
    .filter(Boolean);
}

function resolveRoles(groups: string[]): string[] {
  const normalized = groups.map((g) => g.toLowerCase());
  if (normalized.some((g) => g.includes("deps_admins") || g.includes("deps-admins"))) return ["ADMIN"];
  if (normalized.some((g) => g.includes("deps_editors") || g.includes("deps-editors"))) return ["EDITOR"];
  return ["VIEWER"];
}

async function findUserByLogin(client: Client, login: string) {
  const normalized = login.trim();
  const candidates = new Set<string>([normalized]);
  if (normalized.includes("@")) {
    const short = normalized.split("@")[0]?.trim();
    if (short) candidates.add(short);
  }
  if (normalized.includes("\\")) {
    const short = normalized.split("\\").pop()?.trim();
    if (short) candidates.add(short);
  }

  const clauses: string[] = [];
  for (const candidate of candidates) {
    const escaped = escapeFilter(candidate);
    clauses.push(`(mail=${escaped})`);
    clauses.push(`(uid=${escaped})`);
    clauses.push(`(sAMAccountName=${escaped})`);
    clauses.push(`(userPrincipalName=${escaped})`);
  }

  const userFilter = `(|${clauses.join("")})`;
  const userSearch = await client.search(LDAP_CONFIG.userBaseDn, {
    scope: "sub",
    filter: userFilter,
    attributes: ["dn", "uid", "mail", "cn", "displayName", "entryUUID", "memberOf"],
  });

  const user = userSearch.searchEntries[0] as Record<string, unknown> | undefined;
  if (!user) return null;

  const dn = getAttr(user, "dn");
  const uid = getAttr(user, "uid");
  const email = (getAttr(user, "mail") || login).trim().toLowerCase();
  const displayName = getAttr(user, "displayName") || getAttr(user, "cn") || email.split("@")[0];
  const externalId = getAttr(user, "entryUUID") || uid || dn || email;
  const memberOf = getAttrArray(user, "memberOf");

  return { dn, uid, email, displayName, externalId, memberOf };
}

async function resolveGroups(client: Client, params: { dn: string; uid: string; memberOf?: string[] }) {
  const fromMemberOf = extractGroupNamesFromMemberOf(params.memberOf || []);
  let fromGroupSearch: string[] = [];
  try {
    const escapedDn = escapeFilter(params.dn);
    const escapedUid = escapeFilter(params.uid);
    const groupFilter = `(|(member=${escapedDn})(member:1.2.840.113556.1.4.1941:=${escapedDn})(uniqueMember=${escapedDn})(memberUid=${escapedUid}))`;
    const groupSearch = await client.search(LDAP_CONFIG.groupBaseDn, {
      scope: "sub",
      filter: groupFilter,
      attributes: ["cn"],
    });
    fromGroupSearch = groupSearch.searchEntries
      .flatMap((entry) => getAttrArray(entry as Record<string, unknown>, "cn"))
      .filter(Boolean);
  } catch {
    fromGroupSearch = [];
  }
  return Array.from(new Set([...fromMemberOf, ...fromGroupSearch]));
}

async function lookup(login: string) {
  const client = new Client({ url: LDAP_CONFIG.url, timeout: 8000, connectTimeout: 8000 });
  try {
    await client.bind(LDAP_CONFIG.bindDn, LDAP_CONFIG.bindPassword);
    const found = await findUserByLogin(client, login);
    if (!found) return null;
    const groups = await resolveGroups(client, { dn: found.dn, uid: found.uid, memberOf: found.memberOf });
    return { externalId: found.externalId, email: found.email, displayName: found.displayName, groups, dn: found.dn };
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

export async function authenticateFromLogin(login: string, password: string) {
  const normalized = login.trim().toLowerCase();
  if (!password?.trim()) return null;

  const identity = await lookup(normalized);
  if (!identity) return null;

  const client = new Client({ url: LDAP_CONFIG.url, timeout: 8000, connectTimeout: 8000 });
  try {
    if (identity.dn) {
      await client.bind(identity.dn, password);
    } else {
      await client.bind(identity.email, password);
    }

    const roles = resolveRoles(identity.groups);
    const token = createSessionToken(identity.externalId, identity.email, roles);
    const res = NextResponse.json({
      ok: true,
      email: identity.email,
      displayName: identity.displayName,
      roles,
      provider: "ldap",
    });
    res.headers.set("Set-Cookie", sessionCookieHeader(token));
    return res;
  } catch {
    return null;
  } finally {
    await client.unbind().catch(() => undefined);
  }
}
