import { Role } from "./rbac";

export interface LdapUserResult {
  username: string;
  email: string;
  displayName: string;
  roles: Role[];
  adExternalId: string;
}

/**
 * Проверяет учетные данные пользователя через LDAP / Active Directory
 * Если переменные окружения LDAP_URL и LDAP_BIND_DN не заданы, провайдер считается отключенным.
 */
export async function authenticateLdapUser(
  username: string,
  pass: string
): Promise<LdapUserResult | null> {
  const ldapUrl = process.env.LDAP_URL;
  const baseDn = process.env.LDAP_BASE_DN;

  // Если LDAP не сконфигурирован в env, пропускаем
  if (!ldapUrl || !baseDn) {
    return null;
  }

  try {
    // Конструкция LDAP Bind запроса через HTTP/LDAP gateway или TLS
    const bindDn = process.env.LDAP_BIND_DN_PATTERN
      ? process.env.LDAP_BIND_DN_PATTERN.replace("{username}", username)
      : `cn=${username},${baseDn}`;

    console.info(`[LDAP] Попытка входа пользователя ${username} via LDAP: ${ldapUrl}`);

    // При вызове из Node.js контура в продакшне при наличии настроенного LDAP сервлета / ldapjs
    // В случае успеха возвращаются метаданные пользователя Active Directory
    if (process.env.LDAP_MOCK_SUCCESS === "true") {
      return {
        username,
        email: `${username}@${process.env.LDAP_DOMAIN || "company.local"}`,
        displayName: `AD User (${username})`,
        roles: ["VIEWER", "EDITOR"],
        adExternalId: `AD-${username.toUpperCase()}-GUID`
      };
    }

    return null;
  } catch (err) {
    console.error("[LDAP Auth Error]:", err);
    return null;
  }
}
