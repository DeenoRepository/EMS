/**
 * Token Blacklist & Session Revocation Service (SEC-11)
 * Поддержка мгновенного отзыва JWT-токенов по хэшу от их уникального `jti`.
 * Совместимо с Edge Runtime (Next.js Middleware).
 */

const revokedJtiHashes = new Map<string, number>();

/**
 * Вычисляет хэш идентификатора `jti`.
 * Совместимо с Edge Runtime (Next.js Middleware) и Node.js без внешней зависимости crypto.
 */
export function hashJti(jti: string): string {
  if (!jti) return "";
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < jti.length; i++) {
    const ch = jti.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x01000193);
  }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

/**
 * Вносит `jti` токена в реестр отозванных по его хэшу
 * @param jtiOrToken - Уникальный jti или JWT токен
 * @param ttlSeconds - время жизни отзыва в секундах (по умолчанию 2 часа)
 */
export function revokeToken(jtiOrToken: string, ttlSeconds = 2 * 60 * 60): void {
  if (!jtiOrToken) return;
  const hash = hashJti(jtiOrToken);
  const expiresAt = Date.now() + ttlSeconds * 1000;
  revokedJtiHashes.set(hash, expiresAt);
}

/**
 * Проверяет, отозван ли токен по хэшу его `jti`
 */
export function isTokenRevoked(jtiOrToken: string): boolean {
  if (!jtiOrToken) return false;
  const hash = hashJti(jtiOrToken);
  const expiresAt = revokedJtiHashes.get(hash);

  if (!expiresAt) return false;

  if (Date.now() > expiresAt) {
    revokedJtiHashes.delete(hash);
    return false;
  }

  return true;
}

// Периодическая очистка просроченных записей
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [hash, expiresAt] of revokedJtiHashes.entries()) {
      if (now > expiresAt) {
        revokedJtiHashes.delete(hash);
      }
    }
  }, 15 * 60 * 1000);
}
