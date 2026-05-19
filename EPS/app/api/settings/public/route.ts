import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/rbac";
import { readProjectSettings } from "@/lib/settings/store";

export async function GET() {
  await requireAnyRole(["VIEWER", "EDITOR", "APPROVER", "ADMIN"]);
  const settings = await readProjectSettings();

  return NextResponse.json({
    workflow: settings.workflow,
    ui: settings.ui,
    documents: settings.documents,
    storage: settings.storage
  });
}
