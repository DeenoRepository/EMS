import { NextRequest, NextResponse } from "next/server";
import { readSecureFile } from "@/lib/storage/secure-provider";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }

  const rawPath = req.nextUrl.searchParams.get("path") || req.nextUrl.searchParams.get("file") || "";

  if (!rawPath) {
    return NextResponse.json({ error: "Параметр файла обязателен" }, { status: 400 });
  }

  try {
    const file = await readSecureFile(rawPath);

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (err: any) {
    if (err.message?.includes("Path traversal")) {
      return NextResponse.json(
        { error: "Доступ запрещен: попытка несанкционированного доступа к файловой системе (SEC-06)" },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Файл не найден на диске" }, { status: 404 });
  }
}
