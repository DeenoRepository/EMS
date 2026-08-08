import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MOCK_USERS, Role } from "@/lib/auth/rbac";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { authenticateLdapUser } from "@/lib/auth/ldap";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Укажите имя пользователя и пароль" }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    // 0. Попытка аутентификации через LDAP / Active Directory (при наличии LDAP_URL в env)
    try {
      const ldapUser = await authenticateLdapUser(cleanUsername, password);
      if (ldapUser) {
        // Создаем или получаем пользователя в локальной БД для сохранения истории
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

        const sessionPayload = {
          id: dbUser.id,
          username: ldapUser.username,
          displayName: ldapUser.displayName,
          email: ldapUser.email,
          roles: ldapUser.roles
        };

        const token = await createSessionToken(sessionPayload);
        await setSessionCookie(token);

        const response = NextResponse.json({ success: true, user: sessionPayload });
        response.cookies.set("ems_session", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 8 * 60 * 60
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
            include: { role: true }
          }
        }
      });

      if (dbUser) {
        // Если у пользователя есть passwordHash, проверяем его через bcrypt
        let isValidPassword = false;
        if (dbUser.passwordHash) {
          isValidPassword = await bcrypt.compare(password, dbUser.passwordHash);
        }

        if (isValidPassword) {
          const roles: Role[] = dbUser.userRoles.map((ur) => ur.role.key as Role);
          const sessionPayload = {
            id: dbUser.id,
            username: dbUser.email.split("@")[0],
            displayName: dbUser.displayName,
            email: dbUser.email,
            roles: roles.length > 0 ? roles : (["VIEWER"] as Role[])
          };

          const token = await createSessionToken(sessionPayload);
          try {
            await setSessionCookie(token);
          } catch (cErr) {
            console.warn("Set session cookie warning:", cErr);
          }

          const response = NextResponse.json({ success: true, user: sessionPayload });
          response.cookies.set("ems_session", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 8 * 60 * 60
          });

          return response;
        } else if (dbUser.passwordHash) {
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
    // В продуктивном контуре (NODE_ENV=production) MOCK-авторизация СТРОГО заблокирована
    if (process.env.NODE_ENV === "production" || process.env.ENABLE_MOCK_AUTH === "false") {
      return NextResponse.json(
        { error: "Неверный логин или пароль" },
        { status: 401 }
      );
    }

    const userEntry = MOCK_USERS[cleanUsername];
    if (!userEntry || userEntry._devPassword !== password) {
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

    const response = NextResponse.json({ success: true, user: sessionPayload });
    response.cookies.set("ems_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60
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
