/**
 * Redis клиент для EMS (SEC-03)
 *
 * Используется для:
 * - Token blacklist (отзыв JWT токенов)
 * - Rate limiting (защита от brute-force)
 * - Event bus (pub/sub для межмодульных событий)
 * - Circuit breaker (состояние модулей)
 * - Webhook subscriptions (временное хранилище)
 *
 * Fallback на in-memory для development/test окружений.
 */
import { Redis } from "ioredis";
import { env, isProduction } from "@/lib/config/env";

/**
 * Singleton Redis клиент
 */
let redisClient: Redis | null = null;
let useFallback = false;

/**
 * In-memory fallback для development
 */
const memoryStore = new Map<string, { value: string; expiresAt?: number }>();

function cleanupMemory() {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
        if (entry.expiresAt && entry.expiresAt < now) {
            memoryStore.delete(key);
        }
    }
}

/**
 * Получить Redis клиент
 *
 * В production — подключается к Redis.
 * В development — fallback на in-memory с предупреждением.
 */
export function getRedis(): Redis | null {
    if (useFallback) return null;
    if (redisClient) return redisClient;

    // В production Redis обязателен
    if (isProduction && !process.env.REDIS_URL) {
        throw new Error(
            "CRITICAL: REDIS_URL is required in production for SEC-03 compliance"
        );
    }

    // В development без REDIS_URL — fallback на in-memory
    if (!process.env.REDIS_URL) {
        if (!useFallback) {
            console.warn(
                "⚠️  REDIS_URL not configured. Using in-memory fallback (NOT for production!)"
            );
            useFallback = true;
        }
        return null;
    }

    try {
        redisClient = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 3) {
                    console.error("Redis connection failed after 3 retries");
                    return null;
                }
                return Math.min(times * 100, 3000);
            },
            enableReadyCheck: true,
            lazyConnect: false,
        });

        redisClient.on("error", (err) => {
            console.error("[Redis] Connection error:", err.message);
        });

        redisClient.on("connect", () => {
            console.log("[Redis] Connected successfully");
        });

        return redisClient;
    } catch (err) {
        console.error("[Redis] Failed to create client:", err);
        useFallback = true;
        return null;
    }
}

/**
 * Установить значение с TTL (в секундах)
 */
export async function setWithTTL(
    key: string,
    value: string,
    ttlSeconds?: number
): Promise<void> {
    const redis = getRedis();

    if (redis) {
        if (ttlSeconds) {
            await redis.set(key, value, "EX", ttlSeconds);
        } else {
            await redis.set(key, value);
        }
        return;
    }

    // Fallback на in-memory
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    memoryStore.set(key, { value, expiresAt });
}

/**
 * Получить значение
 */
export async function get(key: string): Promise<string | null> {
    const redis = getRedis();

    if (redis) {
        return await redis.get(key);
    }

    // Fallback на in-memory
    cleanupMemory();
    const entry = memoryStore.get(key);
    return entry?.value ?? null;
}

/**
 * Удалить значение
 */
export async function del(key: string): Promise<void> {
    const redis = getRedis();

    if (redis) {
        await redis.del(key);
        return;
    }

    memoryStore.delete(key);
}

/**
 * Проверить существование ключа
 */
export async function exists(key: string): Promise<boolean> {
    const redis = getRedis();

    if (redis) {
        const result = await redis.exists(key);
        return result === 1;
    }

    cleanupMemory();
    return memoryStore.has(key);
}

/**
 * Инкремент с TTL (для rate limiting)
 */
export async function incrWithTTL(
    key: string,
    ttlSeconds: number
): Promise<number> {
    const redis = getRedis();

    if (redis) {
        const multi = redis.multi();
        multi.incr(key);
        multi.expire(key, ttlSeconds);
        const results = await multi.exec();
        return (results?.[0]?.[1] as number) ?? 0;
    }

    // Fallback на in-memory
    cleanupMemory();
    const entry = memoryStore.get(key);
    const now = Date.now();

    if (!entry || (entry.expiresAt && entry.expiresAt < now)) {
        const newValue = "1";
        memoryStore.set(key, {
            value: newValue,
            expiresAt: now + ttlSeconds * 1000,
        });
        return 1;
    }

    const newCount = parseInt(entry.value, 10) + 1;
    memoryStore.set(key, {
        value: String(newCount),
        expiresAt: entry.expiresAt,
    });
    return newCount;
}

/**
 * Получить TTL ключа (в секундах)
 */
export async function getTTL(key: string): Promise<number> {
    const redis = getRedis();

    if (redis) {
        return await redis.ttl(key);
    }

    const entry = memoryStore.get(key);
    if (!entry?.expiresAt) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
}

/**
 * Закрыть соединение (для graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
    memoryStore.clear();
}

/**
 * Проверить доступность Redis
 */
export async function isRedisAvailable(): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;

    try {
        await redis.ping();
        return true;
    } catch {
        return false;
    }
}
