import { SignJWT, jwtVerify } from "jose";

const SERVICE_JWT_SECRET = new TextEncoder().encode(
  process.env.SERVICE_JWT_SECRET || "ems-inter-module-service-token-secret-2026"
);

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
