import { NextRequest, NextResponse } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

function now() {
  return Date.now();
}

function normalizeOrigin(input: string) {
  return input.trim().toLowerCase().replace(/\/$/, "");
}

function getExpectedOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  if (!host) return null;
  return normalizeOrigin(`${proto}://${host}`);
}

export function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") || "unknown";
}

export function enforceSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected = getExpectedOrigin(req);

  const secFetchSite = (req.headers.get("sec-fetch-site") || "").toLowerCase();
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    throw new Response("CSRF fetch-site check failed", { status: 403 });
  }

  if (!origin) return;
  if (!expected) {
    throw new Response("Forbidden", { status: 403 });
  }

  const allowedOrigins = new Set<string>([expected]);
  const configured = process.env.ALLOWED_ORIGINS || "";
  configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => allowedOrigins.add(normalizeOrigin(item)));

  if (!allowedOrigins.has(normalizeOrigin(origin))) {
    throw new Response("CSRF origin check failed", { status: 403 });
  }
}

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const { key, limit, windowMs } = params;
  const ts = now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= ts) {
    buckets.set(key, { count: 1, resetAt: ts + windowMs });
    return { allowed: true, limit, remaining: limit - 1, resetInMs: windowMs };
  }

  existing.count += 1;
  buckets.set(key, existing);

  if (existing.count > limit) {
    return { allowed: false, limit, remaining: 0, resetInMs: existing.resetAt - ts };
  }

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetInMs: existing.resetAt - ts
  };
}

export function rateLimitResponse(resetInMs: number, limit?: number, remaining?: number) {
  const res = NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  res.headers.set("Retry-After", String(Math.ceil(resetInMs / 1000)));
  if (typeof limit === "number") res.headers.set("X-RateLimit-Limit", String(limit));
  if (typeof remaining === "number") res.headers.set("X-RateLimit-Remaining", String(remaining));
  res.headers.set("X-RateLimit-Reset", String(Math.ceil(resetInMs / 1000)));
  return res;
}

export function enforceWriteRateLimit(
  req: NextRequest,
  options?: {
    scope?: string;
    limit?: number;
    windowMs?: number;
  }
) {
  const ip = getClientIp(req);
  const method = req.method.toUpperCase();
  const scope = options?.scope || "api";
  const limit = options?.limit ?? Number(process.env.WRITE_RATE_LIMIT || 90);
  const windowMs = options?.windowMs ?? Number(process.env.WRITE_RATE_WINDOW_MS || 60_000);

  const result = checkRateLimit({
    key: `write:${scope}:${method}:${ip}`,
    limit,
    windowMs
  });

  if (!result.allowed) {
    return rateLimitResponse(result.resetInMs, result.limit, result.remaining);
  }

  return null;
}
