/**
 * Rate Limiter для защиты от brute-force атак (SEC-03, SEC-14)
 *
 * Использует Redis для работы в multi-instance окружениях.
 * Fallback на in-memory для development/test.
 */

import { incrWithTTL, getTTL } from "@/lib/db/redis";

const RATE_LIMIT_PREFIX = "ratelimit:login:";

const MAX_LOGIN_ATTEMPTS = 5; // Максимум 5 попыток
const WINDOW_SECONDS = 15 * 60; // 15 минут окно блокировки

export interface RateLimitCheckResult {
  isBlocked: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

/**
 * Проверяет текущее состояние попыток входа для комбинации IP/Username (SEC-14)
 */
export async function checkLoginRateLimit(identifier: string): Promise<RateLimitCheckResult> {
  const key = `${RATE_LIMIT_PREFIX}${identifier}`;
  const attempts = await incrWithTTL(key, WINDOW_SECONDS);

  if (attempts === 0) {
    // Ключ не существовал, только что создан
    return {
      isBlocked: false,
      remainingAttempts: MAX_LOGIN_ATTEMPTS - 1,
    };
  }

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    const ttl = await getTTL(key);
    return {
      isBlocked: true,
      remainingAttempts: 0,
      retryAfterSeconds: Math.max(1, ttl),
    };
  }

  return {
    isBlocked: false,
    remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts,
  };
}

/**
 * Регистрирует неудачную попытку входа
 *
 * Примечание: в Redis-версии incrWithTTL уже инкрементирует счётчик,
 * поэтому эта функция просто проверяет текущее состояние.
 */
export async function registerFailedLoginAttempt(identifier: string): Promise<void> {
  const key = `${RATE_LIMIT_PREFIX}${identifier}`;
  await incrWithTTL(key, WINDOW_SECONDS);
}

/**
 * Сбрасывает счетчик неудачных попыток при успешной авторизации
 */
export async function resetLoginAttempts(identifier: string): Promise<void> {
  const { del } = await import("@/lib/db/redis");
  const key = `${RATE_LIMIT_PREFIX}${identifier}`;
  await del(key);
}
