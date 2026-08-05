import { NextRequest, NextResponse } from "next/server";
import { storeLocalFile } from "@/lib/storage/provider";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await storeLocalFile({
      fileName: file.name || "document.pdf",
      mimeType: file.type || "application/pdf",
      bytes
    });

    return NextResponse.json(stored);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка загрузки файла";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
