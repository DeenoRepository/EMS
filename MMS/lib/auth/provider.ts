import { RoleKey } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { Client } from "ldapts";
import { AUTH_COOKIE, DEMO_COOKIE } from "@/lib/auth/session";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  roles: RoleKey[];
};

export type ExternalIdentity = {
  externalId: string;
  email: string;
  displayName: string;
  groups: string[];
  dn?: string;
};

export interface AuthProvider {
  name: string;
  authenticate: () => Promise<ExternalIdentity | null>;
  resolveRoles: (groups: string[]) => RoleKey[];
}

function parseUserList(value: string | undefined) {
  return new Set(
    (value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function applyRoleOverridesByEmail(email: string, roles: RoleKey[]) {
  const normalized = email.trim().toLowerCase();
  const admins = parseUserList(process.env.LDAP_ADMIN_USERS);
  const approvers = parseUserList(process.env.LDAP_APPROVER_USERS);
  const editors = parseUserList(process.env.LDAP_EDITOR_USERS);

  if (admins.has(normalized)) return ["ADMIN"] as RoleKey[];
  if (approvers.has(normalized)) return ["APPROVER"] as RoleKey[];
  if (editors.has(normalized)) return ["EDITOR"] as RoleKey[];
  return roles;
}

class MockProvider implements AuthProvider {
  name = "mock";

  private deriveGroups(email: string): string[] {
    const groups = ["DEPS_Viewers"];
    if (email.includes("admin")) groups.splice(0, groups.length, "DEPS_Admins");
    if (email.includes("approver")) groups.splice(0, groups.length, "DEPS_Approvers");
    if (email.includes("editor")) groups.splice(0, groups.length, "DEPS_Editors");
    return groups;
  }

  authenticateFromLogin(login: string): ExternalIdentity {
    const email = login.trim().toLowerCase();
    return {
      externalId: email,
      email,
      displayName: email.split("@")[0],
      groups: this.deriveGroups(email)
    };
  }

  async authenticate(): Promise<ExternalIdentity | null> {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const email = cookieStore.get(AUTH_COOKIE)?.value || cookieStore.get(DEMO_COOKIE)?.value || headerStore.get("x-user-email") || "admin@enterprise.local";
    return this.authenticateFromLogin(email);
  }

  resolveRoles(groups: string[]): RoleKey[] {
    if (groups.includes("DEPS_Admins")) return ["ADMIN"];
    if (groups.includes("DEPS_Approvers")) return ["APPROVER"];
    if (groups.includes("DEPS_Editors")) return ["EDITOR"];
    return ["VIEWER"];
  }

  async healthCheck() {
    return {
      ok: true,
      provider: this.name,
      message: "Тестовый провайдер всегда доступен в локальном режиме"
    };
  }
}

class LdapProvider implements AuthProvider {
  name = "ldap";
  private config = {
    url: process.env.LDAP_URL || "ldap://127.0.0.1:3890",
    bindDn: process.env.LDAP_BIND_DN || "",
    bindPassword: process.env.LDAP_BIND_PASSWORD || "",
    baseDn: process.env.LDAP_BASE_DN || "dc=enterprise,dc=local",
    userBaseDn: process.env.LDAP_USER_BASE_DN || "ou=people,dc=enterprise,dc=local",
    groupBaseDn: process.env.LDAP_GROUP_BASE_DN || "ou=groups,dc=enterprise,dc=local"
  };
  private directBindMode = (process.env.LDAP_DIRECT_BIND || "false").toLowerCase() === "true";

  private hasServiceBind() {
    return Boolean(this.config.bindDn.trim() && this.config.bindPassword.trim());
  }

  private useDirectBind() {
    return this.directBindMode || !this.hasServiceBind();
  }

  isUsingDirectBind() {
    return this.useDirectBind();
  }

  isDirectBindOnly() {
    return this.useDirectBind() && !this.hasServiceBind();
  }

  private identityFromLogin(login: string): ExternalIdentity {
    const normalized = login.trim().toLowerCase();
    const email = normalized.includes("@") ? normalized : `${normalized}@local`;
    return {
      externalId: normalized,
      email,
      displayName: email.split("@")[0],
      groups: []
    };
  }

  private extractGroupNamesFromMemberOf(rawValues: string[]) {
    return rawValues
      .map((value) => {
        const match = value.match(/(?:^|,)cn=([^,]+)/i);
        return match?.[1] || value;
      })
      .filter(Boolean);
  }

  private async findUserByLogin(client: Client, login: string) {
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
      const escaped = this.escapeFilter(candidate);
      clauses.push(`(mail=${escaped})`);
      clauses.push(`(uid=${escaped})`);
      clauses.push(`(sAMAccountName=${escaped})`);
      clauses.push(`(userPrincipalName=${escaped})`);
    }

    const userFilter = `(|${clauses.join("")})`;
    const userSearch = await client.search(this.config.userBaseDn, {
      scope: "sub",
      filter: userFilter,
      attributes: ["dn", "uid", "mail", "cn", "displayName", "entryUUID", "memberOf"]
    });

    const user = userSearch.searchEntries[0] as Record<string, unknown> | undefined;
    if (!user) return null;

    const dn = this.getAttr(user, "dn");
    const uid = this.getAttr(user, "uid");
    const email = (this.getAttr(user, "mail") || login).trim().toLowerCase();
    const displayName = this.getAttr(user, "displayName") || this.getAttr(user, "cn") || email.split("@")[0];
    const externalId = this.getAttr(user, "entryUUID") || uid || dn || email;
    const memberOf = this.getAttrArray(user, "memberOf");

    return {
      dn,
      uid,
      email,
      displayName,
      externalId,
      memberOf
    };
  }

  private async resolveGroups(client: Client, params: { dn: string; uid: string; memberOf?: string[] }) {
    const fromMemberOf = this.extractGroupNamesFromMemberOf(params.memberOf || []);

    let fromGroupSearch: string[] = [];
    try {
      const escapedDn = this.escapeFilter(params.dn);
      const escapedUid = this.escapeFilter(params.uid);
      const groupFilter = `(|(member=${escapedDn})(member:1.2.840.113556.1.4.1941:=${escapedDn})(uniqueMember=${escapedDn})(memberUid=${escapedUid}))`;
      const groupSearch = await client.search(this.config.groupBaseDn, {
        scope: "sub",
        filter: groupFilter,
        attributes: ["cn"]
      });

      fromGroupSearch = groupSearch.searchEntries
        .flatMap((entry) => this.getAttrArray(entry as Record<string, unknown>, "cn"))
        .filter(Boolean);
    } catch {
      fromGroupSearch = [];
    }

    return Array.from(new Set([...fromMemberOf, ...fromGroupSearch]));
  }

  private escapeFilter(value: string) {
    return value.replace(/[\\()*\0]/g, (char) => {
      const map: Record<string, string> = {
        "\\": "\\5c",
        "*": "\\2a",
        "(": "\\28",
        ")": "\\29",
        "\0": "\\00"
      };
      return map[char] || char;
    });
  }

  private getAttr(entry: Record<string, unknown>, key: string) {
    const raw = entry[key];
    if (Array.isArray(raw)) return raw[0] ? String(raw[0]) : "";
    return raw ? String(raw) : "";
  }

  private getAttrArray(entry: Record<string, unknown>, key: string) {
    const raw = entry[key];
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((item) => String(item));
    return [String(raw)];
  }

  private async lookup(login: string): Promise<ExternalIdentity | null> {
    if (!this.hasServiceBind()) {
      return null;
    }

    const client = new Client({ url: this.config.url, timeout: 8000, connectTimeout: 8000 });
    try {
      await client.bind(this.config.bindDn, this.config.bindPassword);
      const found = await this.findUserByLogin(client, login);
      if (!found) return null;

      const groups = await this.resolveGroups(client, {
        dn: found.dn,
        uid: found.uid,
        memberOf: found.memberOf
      });

      return {
        externalId: found.externalId,
        email: found.email,
        displayName: found.displayName,
        groups,
        dn: found.dn
      };
    } catch {
      return null;
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  async authenticate(): Promise<ExternalIdentity | null> {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const loginFromHeader = headerStore.get("x-user-email")?.trim().toLowerCase() || headerStore.get("x-user-id")?.trim().toLowerCase();
    const loginFromCookie = cookieStore.get(AUTH_COOKIE)?.value?.trim().toLowerCase() || cookieStore.get(DEMO_COOKIE)?.value?.trim().toLowerCase();
    const login = loginFromHeader || loginFromCookie;
    if (!login) {
      return null;
    }

    if (this.useDirectBind()) {
      // In direct-bind mode we cannot safely resolve LDAP groups without a service account.
      // We keep the session identity from the login value and assign VIEWER role by default.
      return this.identityFromLogin(login);
    }

    return this.lookup(login);
  }

  async authenticateFromLogin(login: string, password?: string): Promise<ExternalIdentity | null> {
    const normalized = login.trim().toLowerCase();
    if (!password?.trim()) return null;

    if (this.useDirectBind()) {
      const client = new Client({ url: this.config.url, timeout: 8000, connectTimeout: 8000 });
      try {
        await client.bind(normalized, password);

        let found: Awaited<ReturnType<LdapProvider["findUserByLogin"]>> | null = null;
        try {
          found = await this.findUserByLogin(client, normalized);
        } catch {
          found = null;
        }

        if (!found) {
          return this.identityFromLogin(normalized);
        }

        const groups = await this.resolveGroups(client, {
          dn: found.dn,
          uid: found.uid,
          memberOf: found.memberOf
        });

        return {
          externalId: found.externalId,
          email: found.email,
          displayName: found.displayName,
          groups,
          dn: found.dn
        };
      } catch {
        return null;
      } finally {
        await client.unbind().catch(() => undefined);
      }
    }

    const identity = await this.lookup(normalized);
    if (!identity) return null;

    const client = new Client({ url: this.config.url, timeout: 8000, connectTimeout: 8000 });
    try {
      if (identity.dn) {
        await client.bind(identity.dn, password);
        return identity;
      }
      await client.bind(identity.email, password);
      return identity;
    } catch {
      return null;
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  resolveRoles(groups: string[]): RoleKey[] {
    const normalized = groups.map((group) => group.toLowerCase());
    if (normalized.some((group) => group.includes("deps_admins") || group.includes("deps-admins"))) return ["ADMIN"];
    if (normalized.some((group) => group.includes("deps_approvers") || group.includes("deps-approvers"))) return ["APPROVER"];
    if (normalized.some((group) => group.includes("deps_editors") || group.includes("deps-editors"))) return ["EDITOR"];
    return ["VIEWER"];
  }

  async healthCheck() {
    if (this.useDirectBind()) {
      return {
        ok: true,
        provider: this.name,
        url: this.config.url,
        baseDn: this.config.baseDn,
        userBaseDn: this.config.userBaseDn,
        groupBaseDn: this.config.groupBaseDn,
        mode: "direct_bind",
        message: "LDAP direct-bind mode enabled (service bind is not used)"
      };
    }

    const client = new Client({ url: this.config.url, timeout: 8000, connectTimeout: 8000 });
    const start = Date.now();
    try {
      await client.bind(this.config.bindDn, this.config.bindPassword);
      return {
        ok: true,
        provider: this.name,
        url: this.config.url,
        baseDn: this.config.baseDn,
        userBaseDn: this.config.userBaseDn,
        groupBaseDn: this.config.groupBaseDn,
        latencyMs: Date.now() - start,
        message: "LDAP-подключение успешно"
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка LDAP";
      return {
        ok: false,
        provider: this.name,
        url: this.config.url,
        baseDn: this.config.baseDn,
        userBaseDn: this.config.userBaseDn,
        groupBaseDn: this.config.groupBaseDn,
        latencyMs: Date.now() - start,
        message
      };
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }
}

function getProvider(): AuthProvider {
  const providerName = process.env.AUTH_PROVIDER || "mock";
  if (providerName === "ldap") return new LdapProvider();
  return new MockProvider();
}

export async function lookupExternalIdentity(login: string, password?: string): Promise<{
  provider: string;
  identity: ExternalIdentity | null;
  roles: RoleKey[];
}> {
  const normalized = login.trim().toLowerCase();
  if (!normalized) {
    return { provider: "none", identity: null, roles: [] };
  }

  const provider = getProvider();
  if (provider instanceof LdapProvider) {
    const identity = await provider.authenticateFromLogin(normalized, password);
    const roles = identity ? applyRoleOverridesByEmail(identity.email, provider.resolveRoles(identity.groups)) : [];
    return {
      provider: provider.name,
      identity,
      roles
    };
  }

  if (provider instanceof MockProvider) {
    const identity = provider.authenticateFromLogin(normalized);
    return {
      provider: provider.name,
      identity,
      roles: provider.resolveRoles(identity.groups)
    };
  }

  return { provider: provider.name, identity: null, roles: [] };
}

export function getAuthProviderName() {
  return (process.env.AUTH_PROVIDER || "mock").toLowerCase();
}

export async function checkAuthProviderHealth() {
  const provider = getProvider();
  if (provider instanceof LdapProvider) {
    return provider.healthCheck();
  }
  if (provider instanceof MockProvider) {
    return provider.healthCheck();
  }
  return {
    ok: false,
    provider: provider.name,
    message: "Неизвестный провайдер авторизации"
  };
}

async function ensureRoleRecords() {
  const roles: RoleKey[] = ["VIEWER", "EDITOR", "APPROVER", "ADMIN"];
  await Promise.all(
    roles.map((key) =>
      prisma.role.upsert({
        where: { key },
        update: {},
        create: { key, name: key }
      })
    )
  );
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  await ensureRoleRecords();
  const provider = getProvider();
  const identity = await provider.authenticate();

  if (!identity) {
    throw new Error("Ошибка аутентификации");
  }

  const normalizedEmail = identity.email.trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      displayName: identity.displayName,
      adExternalId: identity.externalId,
      isActive: true
    },
    create: {
      email: normalizedEmail,
      displayName: identity.displayName,
      adExternalId: identity.externalId
    }
  });

  const existingRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: { role: true }
  });
  const existingRoleKeys = Array.from(new Set(existingRoles.map((item) => item.role.key)));
  const hasElevatedExistingRole = existingRoleKeys.some((role) => role === "ADMIN" || role === "APPROVER" || role === "EDITOR");

  // In LDAP direct-bind mode we cannot reliably refresh groups on each request:
  // preserve already assigned roles from DB to avoid role flapping (ADMIN -> VIEWER).
  if (provider instanceof LdapProvider && provider.isUsingDirectBind() && existingRoleKeys.length > 0) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: existingRoleKeys
    };
  }

  let mappedRoles = provider.resolveRoles(identity.groups);
  mappedRoles = applyRoleOverridesByEmail(normalizedEmail, mappedRoles);

  if (provider instanceof LdapProvider) {
    const shouldKeepExistingRoles =
      (identity.groups.length === 0 && existingRoleKeys.length > 0) ||
      (mappedRoles.length === 1 && mappedRoles[0] === "VIEWER" && hasElevatedExistingRole);

    if (shouldKeepExistingRoles) {
      mappedRoles = existingRoleKeys;
    }
  }

  const roleRecords = await prisma.role.findMany({ where: { key: { in: mappedRoles } } });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.createMany({
    data: roleRecords.map((role) => ({
      userId: user.id,
      roleId: role.id
    })),
    skipDuplicates: true
  });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: mappedRoles
  };
}
