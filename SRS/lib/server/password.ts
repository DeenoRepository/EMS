import crypto from "crypto";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(password, salt, 64).toString("base64url");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, packed: string) {
  const [salt, expected] = packed.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("base64url");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
