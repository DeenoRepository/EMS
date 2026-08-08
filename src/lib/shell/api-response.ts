import { NextResponse } from "next/server";

export interface ShellAPIResponseBody<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId: string;
  timestamp: string;
}

export function getCorrelationId(request?: Request): string {
  if (!request) return `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const headerId = request.headers.get("x-correlation-id") || request.headers.get("x-request-id");
  if (headerId) return headerId;
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function createSuccessResponse<T>(data: T, request?: Request, status = 200): NextResponse {
  const correlationId = getCorrelationId(request);
  const responseBody: ShellAPIResponseBody<T> = {
    success: true,
    data,
    correlationId,
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(responseBody, {
    status,
    headers: { "x-correlation-id": correlationId },
  });
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  status = 400,
  request?: Request
): NextResponse {
  const correlationId = getCorrelationId(request);
  const responseBody: ShellAPIResponseBody = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    correlationId,
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(responseBody, {
    status,
    headers: { "x-correlation-id": correlationId },
  });
}
