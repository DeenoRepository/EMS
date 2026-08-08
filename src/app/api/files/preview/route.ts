import { NextRequest, NextResponse } from "next/server";
import { readLocalStoredFile } from "@/lib/storage/provider";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain; charset=utf-8"
};

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
    const ext = file.fileName.split(".").pop()?.toLowerCase() || "";
    const mimeType = MIME_MAP[ext] || "application/octet-stream";

    return new NextResponse(file.bytes, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Файл не найден на диске" }, { status: 404 });
  }
}
