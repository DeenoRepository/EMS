/**
 * Unit tests for api-keys
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/redis", () => ({
    setWithTTL: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(undefined),
    getRedis: vi.fn().mockReturnValue(null),
}));

import { createApiKey, validateApiKey, revokeApiKey } from "../api-keys";
import { setWithTTL, get, del } from "@/lib/db/redis";

describe("api-keys", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createApiKey", () => {
        it("should create API key with correct prefix", async () => {
            const { apiKey, record } = await createApiKey("Test Key", ["VIEWER"]);

            expect(apiKey).toMatch(/^ems_live_/);
            expect(record.name).toBe("Test Key");
            expect(record.roles).toEqual(["VIEWER"]);
            expect(record.isActive).toBe(true);
        });

        it("should store key in Redis with TTL", async () => {
            await createApiKey("Test Key", ["VIEWER"]);

            expect(setWithTTL).toHaveBeenCalledWith(
                expect.stringMatching(/^apikey:/),
                expect.any(String),
                30 * 24 * 60 * 60
            );
        });

        it("should generate unique IDs", async () => {
            const { record: r1 } = await createApiKey("Key 1", ["VIEWER"]);
            const { record: r2 } = await createApiKey("Key 2", ["VIEWER"]);

            expect(r1.id).not.toBe(r2.id);
        });
    });

    describe("validateApiKey", () => {
        it("should return null for empty key", async () => {
            const result = await validateApiKey("");
            expect(result).toBeNull();
        });

        it("should return null for key without correct prefix", async () => {
            const result = await validateApiKey("invalid_prefix_xxx");
            expect(result).toBeNull();
        });

        it("should return null when Redis is not available", async () => {
            const result = await validateApiKey("ems_live_test123");
            expect(result).toBeNull();
        });
    });

    describe("revokeApiKey", () => {
        it("should delete the key from Redis", async () => {
            await revokeApiKey("key_123");

            expect(del).toHaveBeenCalledWith("apikey:key_123");
        });
    });
});
