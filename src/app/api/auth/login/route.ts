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
        await setSessionCookie(token);

        return NextResponse.json({ success: true, user: sessionPayload, provider: "DATABASE" });
      }
    } catch (dbErr) {
      console.warn("Auth DB lookup skipped/failed, falling back to mock auth provider:", dbErr);
    }

    // 2. Фоллбек на MOCK_USERS для работы без БД
    const userEntry = MOCK_USERS[cleanUsername];
    if (!userEntry || userEntry.passwordHash !== password) {
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
    await setSessionCookie(token);

    return NextResponse.json({ success: true, user: sessionPayload, provider: "MOCK" });
  } catch {
    return NextResponse.json(
      { error: "Внутренняя ошибка авторизации" },
      { status: 500 }
    );
  }
}

