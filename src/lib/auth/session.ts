import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { UserSession } from "./rbac";
import { isTokenRevoked } from "./token-blacklist";
import { jwtPayloadSchema } from "./jwt-schema";

function getJwtSecret(): Uint8Array {
  const secretKey =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV !== "production" ? "ems-dev-jwt-secret-key-for-local-development-only-32bytes" : "");
  if (!secretKey) {
    throw new Error("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is mandatory!");
  }
  return new TextEncoder().encode(secretKey);
}

const SESSION_COOKIE_NAME = "ems_session";
const JWT_ISSUER = "ems-auth-service";
const JWT_AUDIENCE = "ems-app";

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
    if (isTokenRevoked(token)) {
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
  } catch {
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
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60 // 2 hours TTL (SEC-10)
    });
  } catch (err) {
    console.warn("Could not set cookie directly:", err);
  }
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
