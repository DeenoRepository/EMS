import { NextResponse } from "next/server";
import { getRegisteredModules } from "@/lib/plugins/registry";

export async function GET() {
  const modules = getRegisteredModules();
  return NextResponse.json({ modules });
}
