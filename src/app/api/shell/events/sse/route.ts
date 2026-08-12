import { NextRequest } from "next/server";
import { ShellEventBus, ShellEvent } from "@/lib/shell/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Отправляем первичный приветственный пинг
      const initData = `data: ${JSON.stringify({ type: "CONNECTED", timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(initData));

      // Функция слушателя новых событий ShellEventBus
      const onEvent = (event: ShellEvent) => {
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
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
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
