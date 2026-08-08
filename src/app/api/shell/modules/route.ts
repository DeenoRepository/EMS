import { NextResponse } from "next/server";
import { MODULES_CONFIG, ModuleManifest } from "@/lib/config/modules";
import { getSession } from "@/lib/auth/session";

export async function GET() {
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

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      modules,
      userSession: session ? { id: session.id, roles: session.roles } : null,
    });
  } catch (error) {
    console.error("[Shell API] Error fetching module registry:", error);
    return NextResponse.json({ error: "Ошибка загрузки реестра модулей" }, { status: 500 });
  }
}
