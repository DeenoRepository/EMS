import { NextRequest, NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { enforceSameOrigin, enforceWriteRateLimit } from "@/lib/security/request";
import { storeLocalFile } from "@/lib/storage/provider";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
  const normalized = name.normalize("NFC");
  const baseName = normalized.split(/[\\/]/).pop() ?? "";
  const withoutControls = baseName.replace(/[\u0000-\u001F\u007F]/g, "");
  const withoutForbidden = withoutControls.replace(/[<>:"/\\|?*]/g, "_");
  const compactSpaces = withoutForbidden.replace(/\s+/g, " ").trim();
  const collapsedDots = compactSpaces.replace(/^\.+/, "").replace(/\.+$/, "");
  const keepSafeChars = collapsedDots.replace(/[^\p{L}\p{N} .,_()@+\-=]/gu, "_");
  const limited = keepSafeChars.slice(0, 180).trim();

  return limited || "document.bin";
}

export async function POST(req: NextRequest) {
  enforceSameOrigin(req);
  const rateLimited = enforceWriteRateLimit(req, { scope: "files:upload", limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;
  await requireAnyRole(["EDITOR", "ADMIN"]);
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  try {
    const stored = await storeLocalFile({
      fileName: sanitizeFileName(file.name || "document.bin"),
      mimeType: file.type || "application/octet-stream",
      bytes: Buffer.from(await file.arrayBuffer())
    });
    return NextResponse.json(stored);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
