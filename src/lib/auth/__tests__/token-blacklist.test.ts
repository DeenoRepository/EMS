/**
 * Unit tests for token-blacklist
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the redis module before importing token-blacklist
vi.mock("@/lib/db/redis", () => ({
    setWithTTL: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(undefined),
}));

import { revokeToken, isTokenRevoked, unrevokeToken, hashJti } from "../token-blacklist";
import { setWithTTL, get, del } from "@/lib/db/redis";

describe("token-blacklist", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("hashJti", () => {
        it("should return empty string for empty input", () => {
            expect(hashJti("")).toBe("");
        });

        it("should return consistent hash for same input", () => {
            const hash1 = hashJti("test-jti-123");
            const hash2 = hashJti("test-jti-123");
            expect(hash1).toBe(hash2);
        });

        it("should return different hashes for different inputs", () => {
            const hash1 = hashJti("jti-1");
            const hash2 = hashJti("jti-2");
            expect(hash1).not.toBe(hash2);
        });

        it("should return 64 character hex string", () => {
            const hash = hashJti("test");
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    describe("revokeToken", () => {
        it("should call setWithTTL with correct key", async () => {
            await revokeToken("test-jti", 3600);

            expect(setWithTTL).toHaveBeenCalledWith(
                expect.stringMatching(/^token:blacklist:/),
                "1",
                3600
            );
        });

        it("should use default TTL of 2 hours", async () => {
            await revokeToken("test-jti");

            expect(setWithTTL).toHaveBeenCalledWith(
                expect.any(String),
                "1",
                2 * 60 * 60
            );
        });

        it("should handle empty input gracefully", async () => {
            await revokeToken("");
            expect(setWithTTL).not.toHaveBeenCalled();
        });
    });

    describe("isTokenRevoked", () => {
        it("should return true if token is in blacklist", async () => {
            vi.mocked(get).mockResolvedValueOnce("1");

            const result = await isTokenRevoked("test-jti");

            expect(result).toBe(true);
        });

        it("should return false if token is not in blacklist", async () => {
            vi.mocked(get).mockResolvedValueOnce(null);

            const result = await isTokenRevoked("test-jti");

            expect(result).toBe(false);
        });

        it("should return false for empty input", async () => {
            const result = await isTokenRevoked("");
            expect(result).toBe(false);
            expect(get).not.toHaveBeenCalled();
        });
    });

    describe("unrevokeToken", () => {
        it("should call del with correct key", async () => {
            await unrevokeToken("test-jti");

            expect(del).toHaveBeenCalledWith(
                expect.stringMatching(/^token:blacklist:/)
            );
        });

        it("should handle empty input gracefully", async () => {
            await unrevokeToken("");
            expect(del).not.toHaveBeenCalled();
        });
    });
});
