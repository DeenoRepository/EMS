/**
 * Unit tests for TTLCache utility
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TTLCache } from "../cache";

describe("TTLCache", () => {
    let cache: TTLCache<string>;

    beforeEach(() => {
        cache = new TTLCache<string>(60); // 60 seconds default TTL
    });

    describe("set and get", () => {
        it("should store and retrieve values", () => {
            cache.set("key1", "value1");
            expect(cache.get("key1")).toBe("value1");
        });

        it("should return null for non-existent keys", () => {
            expect(cache.get("nonexistent")).toBeNull();
        });

        it("should support custom TTL", () => {
            cache.set("key1", "value1", 1); // 1 second
            expect(cache.get("key1")).toBe("value1");
        });
    });

    describe("TTL expiration", () => {
        it("should expire values after TTL", async () => {
            vi.useFakeTimers();
            cache.set("key1", "value1", 1); // 1 second TTL

            expect(cache.get("key1")).toBe("value1");

            vi.advanceTimersByTime(1500); // 1.5 seconds

            expect(cache.get("key1")).toBeNull();
            vi.useRealTimers();
        });
    });

    describe("getOrSet", () => {
        it("should return cached value if exists", async () => {
            cache.set("key1", "cached");
            const factory = vi.fn().mockResolvedValue("fresh");

            const result = await cache.getOrSet("key1", factory);

            expect(result).toBe("cached");
            expect(factory).not.toHaveBeenCalled();
        });

        it("should call factory if value not cached", async () => {
            const factory = vi.fn().mockResolvedValue("fresh");

            const result = await cache.getOrSet("key1", factory);

            expect(result).toBe("fresh");
            expect(factory).toHaveBeenCalledTimes(1);
            expect(cache.get("key1")).toBe("fresh");
        });
    });

    describe("invalidate", () => {
        it("should remove specific key", () => {
            cache.set("key1", "value1");
            cache.set("key2", "value2");

            cache.invalidate("key1");

            expect(cache.get("key1")).toBeNull();
            expect(cache.get("key2")).toBe("value2");
        });

        it("should remove keys by pattern", () => {
            cache.set("user:1", "alice");
            cache.set("user:2", "bob");
            cache.set("post:1", "hello");

            const count = cache.invalidatePattern("^user:");

            expect(count).toBe(2);
            expect(cache.get("user:1")).toBeNull();
            expect(cache.get("user:2")).toBeNull();
            expect(cache.get("post:1")).toBe("hello");
        });
    });

    describe("clear", () => {
        it("should remove all entries", () => {
            cache.set("key1", "value1");
            cache.set("key2", "value2");

            cache.clear();

            expect(cache.get("key1")).toBeNull();
            expect(cache.get("key2")).toBeNull();
            expect(cache.stats().size).toBe(0);
        });
    });

    describe("stats", () => {
        it("should return cache statistics", () => {
            cache.set("key1", "value1");
            cache.set("key2", "value2");

            const stats = cache.stats();

            expect(stats.size).toBe(2);
            expect(stats.keys).toContain("key1");
            expect(stats.keys).toContain("key2");
        });
    });
});
