import { NextRequest, NextResponse } from "next/server";
import { readLocalStoredFile } from "@/lib/storage/provider";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path") || "";

  if (!path) {
    return NextResponse.json({ error: "Параметр path обязателен" }, { status: 400 });
  }

  try {
    const file = await readLocalStoredFile(path);
    return new NextResponse(file.bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Файл не найден на диске" }, { status: 404 });
  }
}
