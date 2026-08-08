import { NextResponse } from "next/server";
import { ShellCronEngine } from "@/lib/shell/cron-engine";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { createSuccessResponse, createErrorResponse } from "@/lib/shell/api-response";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !hasRole(session, ["ADMIN"])) {
    return createErrorResponse("FORBIDDEN", "Отказано в доступе. Требуются права администратора.", null, 403, request);
  }

  const summary = ShellCronEngine.getTasksSummary();
  return createSuccessResponse({ tasks: summary }, request);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasRole(session, ["ADMIN"])) {
    return createErrorResponse("FORBIDDEN", "Отказано в доступе. Требуются права администратора.", null, 403, request);
  }

  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return createErrorResponse("BAD_REQUEST", "Не указан taskId", null, 400, request);
    }

    const result = await ShellCronEngine.runTask(taskId);
    return createSuccessResponse({ taskId, result }, request);
  } catch (error) {
    return createErrorResponse("TASK_EXECUTION_ERROR", String(error), null, 500, request);
  }
}
