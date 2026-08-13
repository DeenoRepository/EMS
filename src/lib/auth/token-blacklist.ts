/**
 * Token Blacklist & Session Revocation Service (SEC-03, SEC-11)
 *
 * Поддержка мгновенного отзыва JWT-токенов по хэшу от их уникального `jti`.
 * Использует Redis для работы в multi-instance окружениях.
 * Fallback на in-memory для development/test.
 */

import { setWithTTL, get, del } from "@/lib/db/redis";

const BLACKLIST_PREFIX = "token:blacklist:";

/**
 * Вычисляет хэш идентификатора `jti`.
 * Совместимо с Edge Runtime (Next.js Middleware) и Node.js без внешней зависимости crypto.
 */
export function hashJti(jti: string): string {
  if (!jti) return "";
  try {
    const nodeCrypto = require("crypto");
    if (nodeCrypto && typeof nodeCrypto.createHash === "function") {
      return nodeCrypto.createHash("sha256").update(jti).digest("hex");
    }
  } catch (_) {
    // Edge runtime fallback
  }

  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < jti.length; i++) {
    const ch = jti.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x01000193);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return (part1 + part2).repeat(4).slice(0, 64);
}

/**
 * Вносит `jti` токена в реестр отозванных (SEC-03)
 *
 * @param jtiOrToken - Уникальный jti или JWT токен
 * @param ttlSeconds - время жизни отзыва в секундах (по умолчанию 2 часа)
 */
export async function revokeToken(jtiOrToken: string, ttlSeconds = 2 * 60 * 60): Promise<void> {
  if (!jtiOrToken) return;
  const hash = hashJti(jtiOrToken);
  const key = `${BLACKLIST_PREFIX}${hash}`;
  await setWithTTL(key, "1", ttlSeconds);
}

/**
 * Проверяет, отозван ли токен по хэшу его `jti` (SEC-03)
 */
export async function isTokenRevoked(jtiOrToken: string): Promise<boolean> {
  if (!jtiOrToken) return false;
  const hash = hashJti(jtiOrToken);
  const key = `${BLACKLIST_PREFIX}${hash}`;
  const result = await get(key);
  return result !== null;
}

/**
 * Удаляет токен из blacklist (для тестов)
 */
export async function unrevokeToken(jtiOrToken: string): Promise<void> {
  if (!jtiOrToken) return;
  const hash = hashJti(jtiOrToken);
  const key = `${BLACKLIST_PREFIX}${hash}`;
  await del(key);
}
