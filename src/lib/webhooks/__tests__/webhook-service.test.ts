/**
 * Unit tests for webhook-service
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/redis", () => ({
    getRedis: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/events/event-bus", () => ({
    eventBus: {
        subscribe: vi.fn(),
    },
}));

import { registerWebhook, unregisterWebhook, getWebhooks, generateWebhookSignature } from "../webhook-service";

describe("webhook-service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("registerWebhook", () => {
        it("should register a new webhook", async () => {
            const sub = await registerWebhook({
                name: "Test Webhook",
                targetUrl: "https://example.com/webhook",
                secretKey: "secret123",
                subscribedEvents: ["EQUIPMENT_CREATED"],
                isActive: true,
            });

            expect(sub.id).toMatch(/^wh_/);
            expect(sub.name).toBe("Test Webhook");
            expect(sub.createdAt).toBeDefined();
        });

        it("should generate unique IDs", async () => {
            const sub1 = await registerWebhook({
                name: "Webhook 1",
                targetUrl: "https://example.com/1",
                secretKey: "s1",
                subscribedEvents: ["*"],
                isActive: true,
            });

            const sub2 = await registerWebhook({
                name: "Webhook 2",
                targetUrl: "https://example.com/2",
                secretKey: "s2",
                subscribedEvents: ["*"],
                isActive: true,
            });

            expect(sub1.id).not.toBe(sub2.id);
        });
    });

    describe("unregisterWebhook", () => {
        it("should remove webhook", async () => {
            const sub = await registerWebhook({
                name: "To Remove",
                targetUrl: "https://example.com",
                secretKey: "s",
                subscribedEvents: ["*"],
                isActive: true,
            });

            const result = await unregisterWebhook(sub.id);

            expect(result).toBe(true);
        });
    });

    describe("getWebhooks", () => {
        it("should return all registered webhooks", async () => {
            await registerWebhook({
                name: "Test 1",
                targetUrl: "https://example.com/1",
                secretKey: "s1",
                subscribedEvents: ["*"],
                isActive: true,
            });

            const webhooks = await getWebhooks();

            expect(webhooks.length).toBeGreaterThan(0);
        });
    });

    describe("generateWebhookSignature", () => {
        it("should generate consistent HMAC signature", () => {
            const payload = '{"event":"test"}';
            const secret = "my-secret";

            const sig1 = generateWebhookSignature(payload, secret);
            const sig2 = generateWebhookSignature(payload, secret);

            expect(sig1).toBe(sig2);
            expect(sig1).toMatch(/^[a-f0-9]{64}$/);
        });

        it("should generate different signatures for different payloads", () => {
            const sig1 = generateWebhookSignature("payload1", "secret");
            const sig2 = generateWebhookSignature("payload2", "secret");

            expect(sig1).not.toBe(sig2);
        });

        it("should generate different signatures for different secrets", () => {
            const sig1 = generateWebhookSignature("payload", "secret1");
            const sig2 = generateWebhookSignature("payload", "secret2");

            expect(sig1).not.toBe(sig2);
        });
    });
});
