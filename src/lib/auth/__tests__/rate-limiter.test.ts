/**
 * Unit tests for rate-limiter
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/redis", () => ({
    incrWithTTL: vi.fn(),
    getTTL: vi.fn(),
    del: vi.fn().mockResolvedValue(undefined),
}));

import { checkLoginRateLimit, registerFailedLoginAttempt, resetLoginAttempts } from "../rate-limiter";
import { incrWithTTL, getTTL, del } from "@/lib/db/redis";

describe("rate-limiter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("checkLoginRateLimit", () => {
        it("should return not blocked on first attempt", async () => {
            vi.mocked(incrWithTTL).mockResolvedValueOnce(1);

            const result = await checkLoginRateLimit("user:127.0.0.1");

            expect(result.isBlocked).toBe(false);
            expect(result.remainingAttempts).toBe(4);
        });

        it("should return blocked after max attempts", async () => {
            vi.mocked(incrWithTTL).mockResolvedValueOnce(5);
            vi.mocked(getTTL).mockResolvedValueOnce(600);

            const result = await checkLoginRateLimit("user:127.0.0.1");

            expect(result.isBlocked).toBe(true);
            expect(result.remainingAttempts).toBe(0);
            expect(result.retryAfterSeconds).toBe(600);
        });

        it("should return remaining attempts correctly", async () => {
            vi.mocked(incrWithTTL).mockResolvedValueOnce(3);

            const result = await checkLoginRateLimit("user:127.0.0.1");

            expect(result.isBlocked).toBe(false);
            expect(result.remainingAttempts).toBe(2);
        });
    });

    describe("registerFailedLoginAttempt", () => {
        it("should increment counter", async () => {
            vi.mocked(incrWithTTL).mockResolvedValueOnce(2);

            await registerFailedLoginAttempt("user:127.0.0.1");

            expect(incrWithTTL).toHaveBeenCalledWith(
                expect.stringMatching(/^ratelimit:login:/),
                15 * 60
            );
        });
    });

    describe("resetLoginAttempts", () => {
        it("should delete the rate limit key", async () => {
            await resetLoginAttempts("user:127.0.0.1");

            expect(del).toHaveBeenCalledWith(
                expect.stringMatching(/^ratelimit:login:/)
            );
        });
    });
});
