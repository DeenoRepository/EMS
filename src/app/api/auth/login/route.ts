import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MOCK_USERS, Role } from "@/lib/auth/rbac";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { authenticateLdapUser } from "@/lib/auth/ldap";
import bcrypt from "bcryptjs";
import {
  checkLoginRateLimit,
  registerFailedLoginAttempt,
  resetLoginAttempts,
} from "@/lib/auth/rate-limiter";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Укажите имя пользователя и пароль" }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const rateLimitIdentifier = `${clientIp}:${cleanUsername}`;

    // SEC-14: Проверка Rate Limiting для предотвращения Brute-Force атак
    const rateCheck = checkLoginRateLimit(rateLimitIdentifier);
    if (rateCheck.isBlocked) {
      return NextResponse.json(
        {
          error: `Превышено число неверных попыток входа (SEC-14). Попробуйте снова через ${rateCheck.retryAfterSeconds} секунд.`,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.retryAfterSeconds || 900),
          },
        }
      );
    }

    // 0. Попытка аутентификации через LDAP / Active Directory (при наличии LDAP_URL в env)
    try {
      const ldapUser = await authenticateLdapUser(cleanUsername, password);
      if (ldapUser) {
        let dbUser = await prisma.user.findUnique({
          where: { email: ldapUser.email }
        });

        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email: ldapUser.email,
              displayName: ldapUser.displayName,
              adExternalId: ldapUser.adExternalId,
              isActive: true
            }
          });
        }

        if (!dbUser.isActive) {
          registerFailedLoginAttempt(rateLimitIdentifier);
          return NextResponse.json(
            { error: "Учетная запись отключена или заблокирована" },
            { status: 403 }
          );
        }

        const sessionPayload = {
          id: dbUser.id,
          username: ldapUser.username,
          displayName: ldapUser.displayName,
          email: ldapUser.email,
          roles: ldapUser.roles
        };

        const token = await createSessionToken(sessionPayload);
        await setSessionCookie(token);
        resetLoginAttempts(rateLimitIdentifier);

        const response = NextResponse.json({ success: true, user: sessionPayload });
        response.cookies.set("ems_session", token, {
          httpOnly: true,
          secure: process.env.COOKIE_SECURE === "true",
          sameSite: "lax",
          path: "/",
          maxAge: 2 * 60 * 60
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
            { displayName: { contains: cleanUsername, mode: "insensitive" } }
          ],
          isActive: true
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

          const response = NextResponse.json({ success: true, user: sessionPayload });
          response.cookies.set("ems_session", token, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === "true",
            sameSite: "lax",
            path: "/",
            maxAge: 2 * 60 * 60
          });

          return response;
        } else if (dbUser.passwordHash) {
          registerFailedLoginAttempt(rateLimitIdentifier);
          return NextResponse.json(
            { error: "Неверное имя пользователя или пароль" },
            { status: 401 }
          );
        }
      }
    } catch (dbErr) {
      console.warn("Auth DB lookup skipped/failed, falling back to mock auth provider:", dbErr);
    }

    // 2. Фоллбек на MOCK_USERS исключительно для локальной разработки (dev/test)
    if (process.env.NODE_ENV === "production" || process.env.ENABLE_MOCK_AUTH === "false") {
      registerFailedLoginAttempt(rateLimitIdentifier);
      return NextResponse.json(
        { error: "Неверный логин или пароль" },
        { status: 401 }
      );
    }

    const userEntry = MOCK_USERS[cleanUsername];
    if (!userEntry || userEntry._devPassword !== password) {
      registerFailedLoginAttempt(rateLimitIdentifier);
      return NextResponse.json(
        { error: "Неверный логин или пароль" },
        { status: 401 }
      );
    }

    const sessionPayload = {
      id: userEntry.id,
      username: userEntry.username,
      displayName: userEntry.displayName,
      email: userEntry.email,
      roles: userEntry.roles
    };

    const token = await createSessionToken(sessionPayload);
    try {
      await setSessionCookie(token);
    } catch (cErr) {
      console.warn("Set session cookie warning:", cErr);
    }

    resetLoginAttempts(rateLimitIdentifier);

    const response = NextResponse.json({ success: true, user: sessionPayload });
    response.cookies.set("ems_session", token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60
    });

    return response;
  } catch (err) {
    console.error("Login route error:", err);
    return NextResponse.json(
      { error: "Внутренняя ошибка авторизации" },
      { status: 500 }
    );
  }
}
