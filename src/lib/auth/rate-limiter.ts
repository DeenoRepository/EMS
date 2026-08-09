interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

const loginAttemptStore = new Map<string, RateLimitRecord>();

const MAX_LOGIN_ATTEMPTS = 5; // Максимум 5 попыток
const WINDOW_MS = 15 * 60 * 1000; // 15 минутокно блокировки

export interface RateLimitCheckResult {
  isBlocked: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

/**
 * Проверяет текущее состояние попыток входа для комбинации IP/Username (SEC-14)
 */
export function checkLoginRateLimit(identifier: string): RateLimitCheckResult {
  const now = Date.now();
  const record = loginAttemptStore.get(identifier);

  if (!record) {
    return {
      isBlocked: false,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
    };
  }

  // Если окно блокировки истекло — сбрасываем счетчик
  if (now > record.resetAt) {
    loginAttemptStore.delete(identifier);
    return {
      isBlocked: false,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
    };
  }

  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return {
      isBlocked: true,
      remainingAttempts: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  return {
    isBlocked: false,
    remainingAttempts: MAX_LOGIN_ATTEMPTS - record.attempts,
  };
}

/**
 * Регистрирует неудачную попытку входа
 */
export function registerFailedLoginAttempt(identifier: string): void {
  const now = Date.now();
  const record = loginAttemptStore.get(identifier);

  if (!record || now > record.resetAt) {
    loginAttemptStore.set(identifier, {
      attempts: 1,
      resetAt: now + WINDOW_MS,
    });
  } else {
    record.attempts += 1;
  }
}

/**
 * Сбрасывает счетчик неудачных попыток при успешной авторизации
 */
export function resetLoginAttempts(identifier: string): void {
  loginAttemptStore.delete(identifier);
}
