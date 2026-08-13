import { NextRequest } from "next/server";
import { ShellEventBus, ShellEvent } from "@/lib/shell/event-bus";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shell/events/sse
 *
 * Server-Sent Events для real-time обновлений UI (SEC-04).
 *
 * Безопасность:
 * - Требуется авторизация (401 если нет сессии)
 * - Фильтрация событий по правам пользователя
 * - Rate limiting через nginx
 *
 * @returns SSE stream с доменными событиями
 */
export async function GET(req: NextRequest) {
  // SEC-04: Проверка авторизации
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const isAdmin = hasRole(session, ["ADMIN"]);

  const stream = new ReadableStream({
    start(controller) {
      // Отправляем первичный приветственный пинг
      const initData = `data: ${JSON.stringify({
        type: "CONNECTED",
        timestamp: new Date().toISOString(),
        userId: session.id,
      })}\n\n`;
      controller.enqueue(encoder.encode(initData));

      // SEC-04: Фильтрация событий по правам пользователя
      const onEvent = (event: ShellEvent) => {
        try {
          // Админы получают все события
          if (isAdmin) {
            const payload = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(payload));
            return;
          }

          // Обычные пользователи получают только события своих модулей
          // и только те, к которым у них есть доступ
          const eventModule = event.sourceModule?.toLowerCase();
          const userRoles = session.roles.map((r) => r.toLowerCase());

          // Проверяем, что событие относится к модулю, доступному пользователю
          const hasAccess =
            (eventModule === "eps" && userRoles.some((r) =>
              r.includes("eps") || r.includes("admin") || r.includes("editor") || r.includes("approver") || r.includes("viewer")
            )) ||
            (eventModule === "wms" && userRoles.some((r) =>
              r.includes("wms") || r.includes("storekeeper") || r.includes("admin")
            )) ||
            eventModule === "shell";

          if (!hasAccess) {
            return; // Пропускаем событие
          }

          // SEC-04: Убираем чувствительные данные из payload для не-админов
          const sanitizedEvent = {
            ...event,
            payload: sanitizePayload(event.payload, session),
          };

          const payload = `data: ${JSON.stringify(sanitizedEvent)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (err) {
          console.error("[SSE Route] Error enqueuing message:", err);
        }
      };

      const unsubscribe = ShellEventBus.addSseClient(onEvent);

      // Интервал поддержания живого соединения (ping каждые 25 сек)
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(keepAlive);
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch { }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // SEC-04: Дополнительные security headers для SSE
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

/**
 * Удаляет чувствительные данные из payload события (SEC-04)
 */
function sanitizePayload(
  payload: Record<string, unknown>,
  session: { id: string; roles: string[] }
): Record<string, unknown> {
  const sanitized = { ...payload };

  // Удаляем внутренние ID и метаданные
  delete sanitized.internalId;
  delete sanitized.systemMetadata;

  // Для не-админов скрываем email других пользователей
  const isAdmin = session.roles.includes("ADMIN");
  if (!isAdmin && typeof sanitized.performedByEmail === "string") {
    // Оставляем только свой email
    if (sanitized.performedByEmail !== session.id) {
      sanitized.performedByEmail = "[hidden]";
    }
  }

  return sanitized;
}
