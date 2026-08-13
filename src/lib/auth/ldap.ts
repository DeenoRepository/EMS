/**
 * LDAP / Active Directory Authentication (SEC-11)
 *
 * Поддерживает реальное подключение к LDAP/AD серверу через ldapjs.
 * Маппинг AD групп → EMS роли настраивается через env переменные.
 *
 * В development/test режиме поддерживается mock через LDAP_MOCK_SUCCESS=true.
 */
import { Role } from "./rbac";
import { logEvent } from "@/lib/telemetry/logger";

const isLdapMockEnabled = process.env.LDAP_MOCK_SUCCESS === "true";
const isLdapMockEnvironment = ["development", "test"].includes(process.env.NODE_ENV ?? "");

if (isLdapMockEnabled && !isLdapMockEnvironment) {
  throw new Error(
    "CRITICAL SECURITY ERROR: LDAP_MOCK_SUCCESS is only allowed in development or test"
  );
}

export interface LdapUserResult {
  username: string;
  email: string;
  displayName: string;
  roles: Role[];
  adExternalId: string;
}

/**
 * Маппинг AD групп на EMS роли
 *
 * Формат env переменной LDAP_GROUP_ROLE_MAPPING:
 *   "cn=admins,ou=groups,dc=company,dc=local:ADMIN;cn=editors,ou=groups,dc=company,dc=local:EDITOR,APPROVER"
 *
 * Если переменная не задана, используется дефолтный маппинг.
 */
function parseGroupRoleMapping(): Map<string, Role[]> {
  const mapping = new Map<string, Role[]>();
  const raw = process.env.LDAP_GROUP_ROLE_MAPPING;

  if (!raw) {
    // Дефолтный маппинг для типовых AD групп
    mapping.set("cn=ems-admins,ou=groups,dc=company,dc=local", ["ADMIN"]);
    mapping.set("cn=ems-editors,ou=groups,dc=company,dc=local", ["EDITOR"]);
    mapping.set("cn=ems-approvers,ou=groups,dc=company,dc=local", ["APPROVER"]);
    mapping.set("cn=ems-storekeepers,ou=groups,dc=company,dc=local", ["STOREKEEPER"]);
    mapping.set("cn=ems-viewers,ou=groups,dc=company,dc=local", ["VIEWER"]);
    return mapping;
  }

  const entries = raw.split(";");
  for (const entry of entries) {
    const [groupDn, rolesStr] = entry.split(":");
    if (!groupDn || !rolesStr) continue;

    const roles = rolesStr
      .split(",")
      .map((r) => r.trim().toUpperCase())
      .filter((r): r is Role =>
        ["ADMIN", "EDITOR", "APPROVER", "STOREKEEPER", "VIEWER"].includes(r)
      );

    if (roles.length > 0) {
      mapping.set(groupDn.trim().toLowerCase(), roles);
    }
  }

  return mapping;
}

/**
 * Определить роли пользователя на основе его AD групп
 */
function resolveRolesFromGroups(groupDns: string[]): Role[] {
  const mapping = parseGroupRoleMapping();
  const roles = new Set<Role>();

  for (const groupDn of groupDns) {
    const normalized = groupDn.trim().toLowerCase();
    const mappedRoles = mapping.get(normalized);
    if (mappedRoles) {
      mappedRoles.forEach((r) => roles.add(r));
    }
  }

  // Если не найдено ни одной группы — даём минимальную роль VIEWER
  if (roles.size === 0) {
    roles.add("VIEWER");
  }

  return Array.from(roles);
}

/**
 * Mock-режим для development/test
 */
function mockLdapAuth(username: string): LdapUserResult {
  return {
    username,
    email: `${username}@${process.env.LDAP_DOMAIN || "company.local"}`,
    displayName: `AD User (${username})`,
    roles: ["VIEWER", "EDITOR"],
    adExternalId: `AD-${username.toUpperCase()}-GUID`,
  };
}

/**
 * Реальная LDAP аутентификация через ldapjs
 *
 * Использует bind для проверки пароля и поиск для получения групп пользователя.
 */
async function realLdapAuth(username: string, pass: string): Promise<LdapUserResult | null> {
  const ldapUrl = process.env.LDAP_URL;
  const baseDn = process.env.LDAP_BASE_DN;
  const bindDn = process.env.LDAP_BIND_DN;
  const bindPassword = process.env.LDAP_BIND_PASSWORD;
  const userSearchFilter = process.env.LDAP_USER_SEARCH_FILTER || "(sAMAccountName={{username}})";
  const groupSearchBase = process.env.LDAP_GROUP_SEARCH_BASE || baseDn;
  const groupSearchFilter = process.env.LDAP_GROUP_SEARCH_FILTER || "(member={{userDn}})";

  if (!ldapUrl || !baseDn) {
    logEvent({
      level: "warn",
      module: "LDAP",
      action: "MISSING_CONFIG",
      details: { reason: "LDAP_URL or LDAP_BASE_DN not configured" },
    });
    return null;
  }

  // Динамический импорт ldapjs (может отсутствовать в dev)
  let ldapjs: typeof import("ldapjs");
  try {
    ldapjs = await import("ldapjs");
  } catch (err) {
    logEvent({
      level: "error",
      module: "LDAP",
      action: "LDAPJS_NOT_INSTALLED",
      details: { error: String(err) },
    });
    console.error("[LDAP] ldapjs package not installed. Run: npm install ldapjs @types/ldapjs");
    return null;
  }

  return new Promise((resolve) => {
    const client = ldapjs.createClient({
      url: ldapUrl,
      timeout: 5000,
      connectTimeout: 5000,
      reconnect: false,
    });

    let resolved = false;
    const safeResolve = (value: LdapUserResult | null) => {
      if (resolved) return;
      resolved = true;
      try {
        client.unbind();
      } catch {
        // ignore
      }
      resolve(value);
    };

    client.on("error", (err: Error) => {
      logEvent({
        level: "error",
        module: "LDAP",
        action: "CONNECTION_ERROR",
        details: { error: err.message, ldapUrl },
      });
      console.error("[LDAP] Connection error:", err.message);
      safeResolve(null);
    });

    // Шаг 1: Bind с сервисным аккаунтом для поиска пользователя
    const bindAsService = bindDn && bindPassword
      ? Promise.resolve().then(() => new Promise<void>((res, rej) => {
        client.bind(bindDn, bindPassword, (err) => {
          if (err) rej(err);
          else res();
        });
      }))
      : Promise.resolve();

    bindAsService
      .then(() => {
        // Шаг 2: Поиск пользователя по username
        const userFilter = userSearchFilter.replace("{{username}}", username);
        const userSearchOptions = {
          filter: userFilter,
          scope: "sub" as const,
          attributes: ["dn", "mail", "displayName", "sAMAccountName", "objectGUID", "memberOf"],
        };

        let userDn: string | null = null;
        let userEmail = "";
        let userDisplayName = username;
        let userGuid = "";

        client.search(baseDn, userSearchOptions, (err, search) => {
          if (err) {
            console.error("[LDAP] User search error:", err.message);
            safeResolve(null);
            return;
          }

          search.on("searchEntry", (entry) => {
            userDn = entry.objectName?.toString() || entry.dn?.toString() || null;
            const attrs = entry.pojo || (entry as unknown as { attributes: Array<{ type: string; values: string[] }> });
            const getAttr = (name: string): string => {
              if (attrs.attributes) {
                const a = attrs.attributes.find((x: { type: string }) => x.type === name);
                return a?.values?.[0] || "";
              }
              return "";
            };
            userEmail = getAttr("mail") || `${username}@${process.env.LDAP_DOMAIN || "company.local"}`;
            userDisplayName = getAttr("displayName") || username;
            userGuid = getAttr("objectGUID") || `AD-${username.toUpperCase()}-GUID`;
          });

          search.on("error", (searchErr) => {
            console.error("[LDAP] Search error:", searchErr.message);
            safeResolve(null);
          });

          search.on("end", () => {
            if (!userDn) {
              logEvent({
                level: "warn",
                module: "LDAP",
                action: "USER_NOT_FOUND",
                details: { username },
              });
              safeResolve(null);
              return;
            }

            // Шаг 3: Bind от имени пользователя для проверки пароля
            client.bind(userDn, pass, (bindErr) => {
              if (bindErr) {
                logEvent({
                  level: "warn",
                  module: "LDAP",
                  action: "INVALID_PASSWORD",
                  details: { username },
                });
                safeResolve(null);
                return;
              }

              // Шаг 4: Получение групп пользователя
              const groupFilter = groupSearchFilter.replace("{{userDn}}", userDn!);
              const groups: string[] = [];

              client.search(
                groupSearchBase,
                { filter: groupFilter, scope: "sub", attributes: ["dn"] },
                (groupErr, groupSearch) => {
                  if (groupErr) {
                    console.error("[LDAP] Group search error:", groupErr.message);
                    // Возвращаем пользователя с дефолтной ролью
                    safeResolve({
                      username,
                      email: userEmail,
                      displayName: userDisplayName,
                      roles: ["VIEWER"],
                      adExternalId: userGuid,
                    });
                    return;
                  }

                  groupSearch.on("searchEntry", (gEntry) => {
                    const dn = gEntry.objectName?.toString() || gEntry.dn?.toString();
                    if (dn) groups.push(dn);
                  });

                  groupSearch.on("error", () => {
                    // ignore
                  });

                  groupSearch.on("end", () => {
                    const roles = resolveRolesFromGroups(groups);
                    logEvent({
                      level: "info",
                      module: "LDAP",
                      action: "AUTH_SUCCESS",
                      details: { username, groupCount: groups.length, roles },
                    });
                    safeResolve({
                      username,
                      email: userEmail,
                      displayName: userDisplayName,
                      roles,
                      adExternalId: userGuid,
                    });
                  });
                }
              );
            });
          });
        });
      })
      .catch((err: Error) => {
        logEvent({
          level: "error",
          module: "LDAP",
          action: "BIND_FAILED",
          details: { error: err.message },
        });
        console.error("[LDAP] Service bind failed:", err.message);
        safeResolve(null);
      });
  });
}

/**
 * Проверяет учетные данные пользователя через LDAP / Active Directory
 *
 * Если LDAP_URL и LDAP_BASE_DN не заданы — возвращает null (провайдер отключен).
 * В development/test с LDAP_MOCK_SUCCESS=true возвращает mock-результат.
 */
export async function authenticateLdapUser(
  username: string,
  pass: string
): Promise<LdapUserResult | null> {
  if (!username || !pass) {
    return null;
  }

  // Mock-режим для development/test
  if (isLdapMockEnabled && isLdapMockEnvironment) {
    console.info(`[LDAP] Mock auth for ${username}`);
    return mockLdapAuth(username);
  }

  // Реальная LDAP аутентификация
  if (!process.env.LDAP_URL || !process.env.LDAP_BASE_DN) {
    return null;
  }

  try {
    console.info(`[LDAP] Authenticating ${username} via ${process.env.LDAP_URL}`);
    return await realLdapAuth(username, pass);
  } catch (err) {
    console.error("[LDAP Auth Error]:", err);
    logEvent({
      level: "error",
      module: "LDAP",
      action: "AUTH_ERROR",
      details: { username, error: String(err) },
    });
    return null;
  }
}
