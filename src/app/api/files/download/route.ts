import { NextRequest, NextResponse } from "next/server";
import { readSecureFile } from "@/lib/storage/secure-provider";
import { getSession } from "@/lib/auth/session";
import { canAccessFile } from "@/lib/storage/access-control";
import { logEvent } from "@/lib/telemetry/logger";

export const runtime = "nodejs";

/**
 * GET /api/files/download
 *
 * Скачать файл из защищённого хранилища (SEC-06).
 *
 * Безопасность:
 * - Требуется авторизация
 * - Проверка прав доступа к файлу через canAccessFile()
 * - Защита от path traversal через secure-provider
 * - Audit logging всех попыток доступа
 */
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
    // SEC-06: Проверка прав доступа к файлу
    const hasAccess = await canAccessFile(rawPath, session);
    if (!hasAccess) {
      logEvent({
        level: "warn",
        module: "STORAGE",
        action: "FILE_ACCESS_DENIED",
        userId: session.id,
        userEmail: session.email,
        details: { path: rawPath, reason: "access_control" },
      });
      return NextResponse.json(
        { error: "Доступ запрещен: недостаточно прав для доступа к файлу (SEC-06)" },
        { status: 403 }
      );
    }

    const file = await readSecureFile(rawPath);

    // Audit log успешного доступа
    logEvent({
      level: "audit",
      module: "STORAGE",
      action: "FILE_DOWNLOADED",
      userId: session.id,
      userEmail: session.email,
      details: { path: rawPath, fileName: file.fileName },
    });

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message?.includes("Path traversal") || error.message?.includes("SEC-07")) {
      logEvent({
        level: "error",
        module: "STORAGE",
        action: "PATH_TRAVERSAL_ATTEMPT",
        userId: session.id,
        userEmail: session.email,
        details: { path: rawPath, error: error.message },
      });
      return NextResponse.json(
        { error: "Доступ запрещен: попытка несанкционированного доступа к файловой системе (SEC-07)" },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Файл не найден на диске" }, { status: 404 });
  }
}
