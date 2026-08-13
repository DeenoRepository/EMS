/**
 * In-memory cache with TTL (PERF-02)
 *
 * Простой кеш для редко меняющихся данных (справочники, permissions, modules).
 * Поддерживает TTL и автоматическую инвалидацию.
 *
 * Для production с несколькими инстансами рекомендуется использовать Redis.
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

export class TTLCache {
    private store = new Map<string, CacheEntry<unknown>>();
    private defaultTTL: number;

    constructor(defaultTTLSeconds = 60) {
        this.defaultTTL = defaultTTLSeconds * 1000;
    }

    /**
     * Получить значение из кеша
     */
    get<T>(key: string): T | null {
        const entry = this.store.get(key);
        if (!entry) return null;

        if (entry.expiresAt < Date.now()) {
            this.store.delete(key);
            return null;
        }

        return entry.value as T;
    }

    /**
     * Установить значение в кеш с TTL
     */
    set<T>(key: string, value: T, ttlSeconds?: number): void {
        const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttl,
        });
    }

    /**
     * Получить или вычислить значение (memoization pattern)
     */
    async getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        ttlSeconds?: number
    ): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== null) return cached;

        const value = await factory();
        this.set(key, value, ttlSeconds);
        return value;
    }

    /**
     * Инвалидировать ключ
     */
    invalidate(key: string): void {
        this.store.delete(key);
    }

    /**
     * Инвалидировать все ключи по паттерну
     */
    invalidatePattern(pattern: string): number {
        const regex = new RegExp(pattern);
        let count = 0;
        for (const key of this.store.keys()) {
            if (regex.test(key)) {
                this.store.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Очистить весь кеш
     */
    clear(): void {
        this.store.clear();
    }

    /**
     * Получить статистику кеша
     */
    stats(): { size: number; keys: string[] } {
        return {
            size: this.store.size,
            keys: Array.from(this.store.keys()),
        };
    }
}

/**
 * Глобальный кеш для справочных данных (PERF-02)
 *
 * TTL по умолчанию: 5 минут (справочники редко меняются)
 */
export const referenceCache = new TTLCache(300);

/**
 * Кеш для permissions (TTL: 1 минута)
 */
export const permissionsCache = new TTLCache(60);

/**
 * Кеш для modules config (TTL: 10 минут)
 */
export const modulesCache = new TTLCache(600);
