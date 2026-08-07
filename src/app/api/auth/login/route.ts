import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MOCK_USERS, Role } from "@/lib/auth/rbac";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username) {
      return NextResponse.json({ error: "Не указано имя пользователя" }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    // 1. Попытка аутентификации через базу данных Prisma
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

        const response = NextResponse.json({ success: true, user: sessionPayload, provider: "DATABASE" });
        response.cookies.set("ems_session", token, {
          httpOnly: true,
          secure: (process.env.NODE_ENV as string) === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 8 * 60 * 60
        });

        return response;
      }
    } catch (dbErr) {
      console.warn("Auth DB lookup skipped/failed, falling back to mock auth provider:", dbErr);
    }

    // 2. Фоллбек на MOCK_USERS исключительно для локального развития (dev/test)
    if (process.env.NODE_ENV === "production" || process.env.ENABLE_MOCK_AUTH === "false") {
      return NextResponse.json(
        { error: "Пользователь не найден или неверный пароль" },
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

    const response = NextResponse.json({ success: true, user: sessionPayload, provider: "MOCK" });
    response.cookies.set("ems_session", token, {
      httpOnly: true,
      secure: (process.env.NODE_ENV as string) === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60
    });

    return response;
  } catch (err) {
    console.error("Login route error:", err);
    return NextResponse.json(
      { error: "Внутренняя ошибка авторизации: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}

