import { NextResponse } from "next/server";

export interface SafeErrorResponseOptions {
  message?: string;
  status?: number;
  code?: string;
  internalError?: unknown;
}

/**
 * Возвращает клиентский ответ об ошибке с уникальным requestId,
 * оставляя подробный стек вызова в серверных логах (SEC-13)
 */
export function createSafeErrorResponse(options: SafeErrorResponseOptions = {}): NextResponse {
  const {
    message = "Внутренняя ошибка сервера",
    status = 500,
    code = "INTERNAL_SERVER_ERROR",
    internalError,
  } = options;

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  if (internalError) {
    console.error(`[Server Error ${requestId}] Details:`, internalError);
  }

  return NextResponse.json(
    {
      error: message,
      code,
      requestId,
    },
    { status }
  );
}
