import { NextResponse } from "next/server";
import { MOCK_USERS } from "@/lib/auth/rbac";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const userEntry = MOCK_USERS[username?.toLowerCase()];
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

    return NextResponse.json({ success: true, user: sessionPayload });
  } catch {
    return NextResponse.json(
      { error: "Внутренняя ошибка авторизации" },
      { status: 500 }
    );
  }
}
