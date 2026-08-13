/**
 * Integration tests for auth endpoints
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
        },
    },
}));

vi.mock("@/lib/auth/session", () => ({
    getSession: vi.fn(),
    createSession: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limiter", () => ({
    checkLoginRateLimit: vi.fn().mockResolvedValue({
        isBlocked: false,
        remainingAttempts: 5,
    }),
    registerFailedLoginAttempt: vi.fn(),
    resetLoginAttempts: vi.fn(),
}));

vi.mock("@/lib/auth/ldap", () => ({
    authenticateLdapUser: vi.fn(),
}));

describe("Auth API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("POST /api/auth/login", () => {
        it("should reject request without body", async () => {
            const { POST } = await import("@/app/api/auth/login/route");

            const request = new Request("http://localhost/api/auth/login", {
                method: "POST",
            });

            const response = await POST(request as any);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
        });

        it("should reject request with invalid JSON", async () => {
            const { POST } = await import("@/app/api/auth/login/route");

            const request = new Request("http://localhost/api/auth/login", {
                method: "POST",
                body: "not-json",
                headers: { "Content-Type": "application/json" },
            });

            const response = await POST(request as any);

            expect(response.status).toBe(400);
        });

        it("should reject missing username/password", async () => {
            const { POST } = await import("@/app/api/auth/login/route");

            const request = new Request("http://localhost/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ username: "", password: "" }),
                headers: { "Content-Type": "application/json" },
            });

            const response = await POST(request as any);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
        });

        it("should reject when rate limited", async () => {
            const { checkLoginRateLimit } = await import("@/lib/auth/rate-limiter");
            vi.mocked(checkLoginRateLimit).mockResolvedValueOnce({
                isBlocked: true,
                remainingAttempts: 0,
                retryAfterSeconds: 600,
            });

            const { POST } = await import("@/app/api/auth/login/route");

            const request = new Request("http://localhost/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ username: "test", password: "pass" }),
                headers: { "Content-Type": "application/json" },
            });

            const response = await POST(request as any);
            const data = await response.json();

            expect(response.status).toBe(429);
            expect(data.error?.code).toBe("RATE_LIMITED");
        });
    });
});
