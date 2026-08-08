/**
 * Token Blacklist & Session Revocation Service
 * Поддержка мгновенного отзыва JWT-токенов при выходе (Logout) или сбросе сессии.
 * Использует In-Memory хранилище с TTL-очисткой, с возможностью расширения до Redis.
 */

const revokedTokens = new Map<string, number>();

// Периодическая очистка просроченных токенов (каждые 15 минут)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [token, expiresAt] of revokedTokens.entries()) {
      if (now > expiresAt) {
        revokedTokens.delete(token);
      }
    }
  }, 15 * 60 * 1000);
}

/**
 * Вносит токен в список отозванных
 * @param token - JWT токен или JTI
 * @param ttlSeconds - время жизни токена в секундах (по умолчанию 8 часов)
 */
export function revokeToken(token: string, ttlSeconds = 8 * 60 * 60): void {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  revokedTokens.set(token, expiresAt);
}

/**
 * Проверяет, отозван ли токен
 */
export function isTokenRevoked(token: string): boolean {
  const expiresAt = revokedTokens.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    revokedTokens.delete(token);
    return false;
  }
  return true;
}
