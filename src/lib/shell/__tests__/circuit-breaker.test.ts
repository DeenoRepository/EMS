/**
 * Unit tests for circuit-breaker
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/redis", () => ({
    setWithTTL: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(undefined),
}));

import { ModuleCircuitBreaker } from "../circuit-breaker";
import { setWithTTL, get } from "@/lib/db/redis";

describe("circuit-breaker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("recordSuccess", () => {
        it("should reset consecutive failures", async () => {
            vi.mocked(get).mockResolvedValueOnce(
                JSON.stringify({
                    moduleId: "eps",
                    status: "DEGRADED",
                    consecutiveFailures: 3,
                })
            );

            await ModuleCircuitBreaker.recordSuccess("eps");

            expect(setWithTTL).toHaveBeenCalledWith(
                expect.stringMatching(/^circuit:health:/),
                expect.stringContaining('"status":"ONLINE"'),
                expect.any(Number)
            );
        });
    });

    describe("recordFailure", () => {
        it("should increment consecutive failures", async () => {
            vi.mocked(get).mockResolvedValueOnce(
                JSON.stringify({
                    moduleId: "eps",
                    status: "ONLINE",
                    consecutiveFailures: 0,
                })
            );

            await ModuleCircuitBreaker.recordFailure("eps", "Test error");

            expect(setWithTTL).toHaveBeenCalledWith(
                expect.stringMatching(/^circuit:health:/),
                expect.stringContaining('"consecutiveFailures":1'),
                expect.any(Number)
            );
        });

        it("should mark module as DEGRADED after threshold", async () => {
            vi.mocked(get).mockResolvedValueOnce(
                JSON.stringify({
                    moduleId: "eps",
                    status: "ONLINE",
                    consecutiveFailures: 2,
                })
            );

            await ModuleCircuitBreaker.recordFailure("eps", "Test error");

            expect(setWithTTL).toHaveBeenCalledWith(
                expect.stringMatching(/^circuit:health:/),
                expect.stringContaining('"status":"DEGRADED"'),
                expect.any(Number)
            );
        });
    });

    describe("getModuleHealth", () => {
        it("should return ONLINE for new module", async () => {
            vi.mocked(get).mockResolvedValueOnce(null);

            const health = await ModuleCircuitBreaker.getModuleHealth("new-module");

            expect(health.status).toBe("ONLINE");
            expect(health.consecutiveFailures).toBe(0);
        });

        it("should return stored health", async () => {
            const stored = {
                moduleId: "eps",
                status: "DEGRADED" as const,
                consecutiveFailures: 5,
            };
            vi.mocked(get).mockResolvedValueOnce(JSON.stringify(stored));

            const health = await ModuleCircuitBreaker.getModuleHealth("eps");

            expect(health.status).toBe("DEGRADED");
            expect(health.consecutiveFailures).toBe(5);
        });
    });

    describe("isModuleAvailable", () => {
        it("should return true for ONLINE module", async () => {
            vi.mocked(get).mockResolvedValueOnce(
                JSON.stringify({
                    moduleId: "eps",
                    status: "ONLINE",
                    consecutiveFailures: 0,
                })
            );

            const available = await ModuleCircuitBreaker.isModuleAvailable("eps");

            expect(available).toBe(true);
        });

        it("should return false for OFFLINE module", async () => {
            vi.mocked(get).mockResolvedValueOnce(
                JSON.stringify({
                    moduleId: "eps",
                    status: "OFFLINE",
                    consecutiveFailures: 10,
                })
            );

            const available = await ModuleCircuitBreaker.isModuleAvailable("eps");

            expect(available).toBe(false);
        });
    });
});
