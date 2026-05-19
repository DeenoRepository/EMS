import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { readLocalStoredFile } from "@/lib/storage/provider";

export const runtime = "nodejs";

function buildContentDisposition(fileName: string) {
  const safeName = fileName.replace(/[\r\n"]/g, "_");
  const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, "_") || "file.bin";
  const encoded = encodeURIComponent(safeName);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(req: NextRequest) {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const path = req.nextUrl.searchParams.get("path") || "";

  if (!path) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  try {
    const file = await readLocalStoredFile(path);
    return new NextResponse(file.bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": buildContentDisposition(file.fileName)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
