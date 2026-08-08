import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie } from "@/lib/auth/session";
import { revokeToken } from "@/lib/auth/token-blacklist";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("ems_session")?.value;

    if (token) {
      revokeToken(token);
    }

    await clearSessionCookie();

    const response = NextResponse.json({ success: true, message: "Сессия успешно завершена" });
    response.cookies.set("ems_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Ошибка при завершении сессии" }, { status: 500 });
  }
}
