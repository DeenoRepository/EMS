import { MODULES_CONFIG, ModuleManifest } from "@/lib/config/modules";
import { getSession } from "@/lib/auth/session";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/shell/api-response";

/**
 * GET /api/shell/modules
 *
 * Получить реестр зарегистрированных модулей платформы.
 *
 * @returns {Promise<{ modules: ModuleManifest[], userSession: { id, roles } | null }>}
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();

    // Возвращаем реестр модулей
    const modules: ModuleManifest[] = Object.values(MODULES_CONFIG).map((mod) => {
      // Если у пользователя ограниченные роли, можно отфильтровать элементы навигации
      return {
        ...mod,
        // Готовность к будущей интеграции MCP: форматируем список экспортруемых инструментов
        aiCapabilities: mod.aiCapabilities || {
          exportableTools: [`${mod.id}_query`, `${mod.id}_manage`],
          supportedIntentActions: [`read_${mod.id}`, `write_${mod.id}`],
        },
      };
    });

    return createSuccessResponse(
      {
        timestamp: new Date().toISOString(),
        modules,
        userSession: session ? { id: session.id, roles: session.roles } : null,
      },
      request
    );
  } catch (error) {
    console.error("[Shell API] Error fetching module registry:", error);
    return createErrorResponse(
      "INTERNAL_ERROR",
      "Ошибка загрузки реестра модулей",
      undefined,
      500,
      request
    );
  }
}
