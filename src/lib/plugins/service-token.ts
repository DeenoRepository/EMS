import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/config/env";

/**
 * Service Token для межмодульной аутентификации (SEC-01)
 *
 * Секрет берётся из валидированных env переменных.
 * В production — fail-fast при отсутствии SERVICE_JWT_SECRET.
 */
const SERVICE_JWT_SECRET = new TextEncoder().encode(env.SERVICE_JWT_SECRET);

export interface ServiceTokenPayload {
  sourceModule: string;
  targetModule: string;
  action: string;
}

export async function generateServiceToken(payload: ServiceTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m") // Короткоживущий токен для межмодульных вызовов
    .sign(SERVICE_JWT_SECRET);
}

export async function verifyServiceToken(token: string): Promise<ServiceTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SERVICE_JWT_SECRET);
    return payload as unknown as ServiceTokenPayload;
  } catch {
    return null;
  }
}
