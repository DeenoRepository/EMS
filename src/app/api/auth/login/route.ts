import { prisma } from "@/lib/db/prisma";
import { MOCK_USERS } from "@/lib/auth/rbac";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { authenticateLdapUser } from "@/lib/auth/ldap";
import { logEvent } from "@/lib/telemetry/logger";
import bcrypt from "bcryptjs";
import {
  checkLoginRateLimit,
  registerFailedLoginAttempt,
  resetLoginAttempts,
} from "@/lib/auth/rate-limiter";
import {
  createSuccessResponse,
  createErrorResponse,
  getCorrelationId,
} from "@/lib/shell/api-response";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Укажите имя пользователя"),
  password: z.string().min(1, "Укажите пароль"),
});

/**
 * POST /api/auth/login
 *
 * Аутентификация пользователя через LDAP / БД / MOCK_USERS (dev).
 * Применяется rate limiting (SEC-14), audit logging и единый формат ответов.
 *
 * @returns {Promise<{ success: true, user: UserSession }>}
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(
        "INVALID_JSON",
        "Неверный формат JSON в теле запроса",
        undefined,
        400,
        request
      );
    }

    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Укажите имя пользователя и пароль",
        validation.error.format(),
        400,
        request
      );
    }

    const { username, password } = validation.data;
    const cleanUsername = username.trim().toLowerCase();
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const rateLimitIdentifier = `${clientIp}:${cleanUsername}`;

    // SEC-14: Проверка Rate Limiting для предотвращения Brute-Force атак
    const rateCheck = checkLoginRateLimit(rateLimitIdentifier);
    if (rateCheck.isBlocked) {
      logEvent({
        level: "warn",
        module: "AUTH",
        action: "LOGIN_RATE_LIMITED",
        requestId: correlationId,
        details: { identifier: rateLimitIdentifier, retryAfter: rateCheck.retryAfterSeconds },
      });
      return createErrorResponse(
        "RATE_LIMITED",
        `Превышено число неверных попыток входа (SEC-14). Попробуйте снова через ${rateCheck.retryAfterSeconds} секунд.`,
        { retryAfterSeconds: rateCheck.retryAfterSeconds },
        429,
        request
      );
    }

    // 0. Попытка аутентификации через LDAP / Active Directory (при наличии LDAP_URL в env)
    try {
      const ldapUser = await authenticateLdapUser(cleanUsername, password);
      if (ldapUser) {
        let dbUser = await prisma.user.findUnique({
          where: { email: ldapUser.email },
        });

        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email: ldapUser.email,
              displayName: ldapUser.displayName,
              adExternalId: ldapUser.adExternalId,
              isActive: true,
            },
          });
        }

        if (!dbUser.isActive) {
          registerFailedLoginAttempt(rateLimitIdentifier);
          logEvent({
            level: "warn",
            module: "AUTH",
            action: "LOGIN_DENIED_INACTIVE",
            requestId: correlationId,
            details: { email: ldapUser.email },
          });
          return createErrorResponse(
            "FORBIDDEN",
            "Учетная запись отключена или заблокирована",
            undefined,
            403,
            request
          );
        }

        const sessionPayload = {
          id: dbUser.id,
          username: ldapUser.username,
          displayName: ldapUser.displayName,
          email: ldapUser.email,
          roles: ldapUser.roles,
        };

        const token = await createSessionToken(sessionPayload);
        await setSessionCookie(token);
        resetLoginAttempts(rateLimitIdentifier);

        logEvent({
          level: "audit",
          module: "AUTH",
          action: "LOGIN_SUCCESS_LDAP",
          userId: dbUser.id,
          userEmail: dbUser.email,
          requestId: correlationId,
        });

        const response = createSuccessResponse({ success: true, user: sessionPayload }, request);
        response.cookies.set("ems_session", token, {
          httpOnly: true,
          secure: process.env.COOKIE_SECURE === "true",
          sameSite: "lax",
          path: "/",
          maxAge: 2 * 60 * 60,
        });

        return response;
      }
    } catch (ldapErr) {
      console.warn("LDAP auth check skipped or failed:", ldapErr);
    }

    // 1. Попытка аутентификации через базу данных Prisma (bcrypt)
    try {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: cleanUsername, mode: "insensitive" } },
            { email: { startsWith: cleanUsername + "@", mode: "insensitive" } },
            { displayName: { contains: cleanUsername, mode: "insensitive" } },
          ],
          isActive: true,
        },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } },
                  scope: true,
                },
              },
            },
          },
        },
      });

      if (dbUser) {
        let isValidPassword = false;
        if (dbUser.passwordHash) {
          isValidPassword = await bcrypt.compare(password, dbUser.passwordHash);
        }

        if (isValidPassword) {
          const roles = dbUser.userRoles.map((ur) => ur.role.key);
          const permissionsSet = new Set<string>();
          dbUser.userRoles.forEach((ur) => {
            if (ur.role.key === "ADMIN") {
              permissionsSet.add("*");
            }
            ur.role.permissions.forEach((rp) => {
              permissionsSet.add(rp.permission.code);
            });
          });

          const sessionPayload = {
            id: dbUser.id,
            username: dbUser.email.split("@")[0],
            displayName: dbUser.displayName,
            email: dbUser.email,
            roles: roles.length > 0 ? roles : ["viewer_readonly"],
            permissions: Array.from(permissionsSet),
          };

          const token = await createSessionToken(sessionPayload);
          try {
            await setSessionCookie(token);
          } catch (cErr) {
            console.warn("Set session cookie warning:", cErr);
          }

          resetLoginAttempts(rateLimitIdentifier);

          logEvent({
            level: "audit",
            module: "AUTH",
            action: "LOGIN_SUCCESS_DB",
            userId: dbUser.id,
            userEmail: dbUser.email,
            requestId: correlationId,
          });

          const response = createSuccessResponse(
            { success: true, user: sessionPayload },
            request
          );
          response.cookies.set("ems_session", token, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === "true",
            sameSite: "lax",
            path: "/",
            maxAge: 2 * 60 * 60,
          });

          return response;
        } else if (dbUser.passwordHash) {
          registerFailedLoginAttempt(rateLimitIdentifier);
          logEvent({
            level: "warn",
            module: "AUTH",
            action: "LOGIN_FAILED_BAD_PASSWORD",
            requestId: correlationId,
            details: { username: cleanUsername },
          });
          return createErrorResponse(
            "INVALID_CREDENTIALS",
            "Неверное имя пользователя или пароль",
            undefined,
            401,
            request
          );
        }
      }
    } catch (dbErr) {
      console.warn("Auth DB lookup skipped/failed, falling back to mock auth provider:", dbErr);
    }

    // 2. Фоллбек на MOCK_USERS исключительно для локальной разработки (dev/test)
    if (process.env.NODE_ENV === "production" || process.env.ENABLE_MOCK_AUTH === "false") {
      registerFailedLoginAttempt(rateLimitIdentifier);
      logEvent({
        level: "warn",
        module: "AUTH",
        action: "LOGIN_FAILED_NO_MOCK",
        requestId: correlationId,
        details: { username: cleanUsername },
      });
      return createErrorResponse(
        "INVALID_CREDENTIALS",
        "Неверный логин или пароль",
        undefined,
        401,
        request
      );
    }

    const userEntry = MOCK_USERS[cleanUsername];
    if (!userEntry || userEntry._devPassword !== password) {
      registerFailedLoginAttempt(rateLimitIdentifier);
      logEvent({
        level: "warn",
        module: "AUTH",
        action: "LOGIN_FAILED_MOCK",
        requestId: correlationId,
        details: { username: cleanUsername },
      });
      return createErrorResponse(
        "INVALID_CREDENTIALS",
        "Неверный логин или пароль",
        undefined,
        401,
        request
      );
    }

    const sessionPayload = {
      id: userEntry.id,
      username: userEntry.username,
      displayName: userEntry.displayName,
      email: userEntry.email,
      roles: userEntry.roles,
    };

    const token = await createSessionToken(sessionPayload);
    try {
      await setSessionCookie(token);
    } catch (cErr) {
      console.warn("Set session cookie warning:", cErr);
    }

    resetLoginAttempts(rateLimitIdentifier);

    logEvent({
      level: "audit",
      module: "AUTH",
      action: "LOGIN_SUCCESS_MOCK",
      userId: userEntry.id,
      userEmail: userEntry.email,
      requestId: correlationId,
    });

    const response = createSuccessResponse({ success: true, user: sessionPayload }, request);
    response.cookies.set("ems_session", token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error("Login route error:", err);
    logEvent({
      level: "error",
      module: "AUTH",
      action: "LOGIN_INTERNAL_ERROR",
      requestId: correlationId,
      error: String(err),
    });
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Внутренняя ошибка авторизации",
      undefined,
      500,
      request
    );
  }
}
