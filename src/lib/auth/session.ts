import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { UserSession } from "./rbac";
import { isTokenRevoked } from "./token-blacklist";
import { jwtPayloadSchema } from "./jwt-schema";
import { env, isProduction } from "@/lib/config/env";

/**
 * Возвращает секрет для подписи JWT токенов (SEC-01)
 *
 * В production — fail-fast при отсутствии JWT_SECRET.
 * В development — используется валидированный env.JWT_SECRET.
 */
function getJwtSecret(): Uint8Array {
  // SEC-01: Секрет всегда берётся из env, никаких fallback'ов
  return new TextEncoder().encode(env.JWT_SECRET);
}

const SESSION_COOKIE_NAME = "ems_session";
const JWT_ISSUER = "ems-auth-service";
const JWT_AUDIENCE = "ems-app";
const SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 часа (SEC-10)

/**
 * Настройки cookie для сессии (SEC-09, SEC-10)
 *
 * - httpOnly: защита от XSS
 * - secure: автоматически true в production
 * - sameSite: "strict" в production для защиты от CSRF
 * - maxAge: соответствует JWT TTL
 */
export function getCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction, // SEC-10: автоматически true в production
    sameSite: isProduction ? ("strict" as const) : ("lax" as const), // SEC-09
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function createSessionToken(payload: UserSession): Promise<string> {
  const jti = `jti_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  return new SignJWT({
    id: payload.id,
    username: payload.username,
    displayName: payload.displayName,
    email: payload.email,
    roles: payload.roles,
    jti,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("2h") // Сокращенный TTL access-токена (SEC-10)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    if (await isTokenRevoked(token)) {
      console.warn("[verifySessionToken] Token is revoked");
      return null;
    }

    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });

    // Валидация структуры JWT payload через Zod (SEC-10)
    const parseResult = jwtPayloadSchema.safeParse(payload);
    if (!parseResult.success) {
      console.warn("JWT Payload validation failed:", parseResult.error.flatten());
      return null;
    }

    const validData = parseResult.data;
    return {
      id: validData.id,
      username: validData.username,
      displayName: validData.displayName,
      email: validData.email,
      roles: validData.roles,
    };
  } catch (err) {
    console.error("[verifySessionToken] verify error stack:", err instanceof Error ? err.stack : err);
    return null;
  }
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string) {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, getCookieOptions());
  } catch (err) {
    console.warn("Could not set cookie directly:", err);
  }
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
