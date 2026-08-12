import { getRegisteredModules } from "@/lib/plugins/registry";
import { getSession } from "@/lib/auth/session";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/shell/api-response";

/**
 * GET /api/modules/registry
 *
 * Получить список зарегистрированных модулей платформы.
 *
 * @returns {Promise<{ modules: ModuleManifest[] }>}
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return createErrorResponse("UNAUTHORIZED", "Необходима авторизация", undefined, 401, request);
  }

  const modules = getRegisteredModules();
  return createSuccessResponse({ modules }, request);
}
