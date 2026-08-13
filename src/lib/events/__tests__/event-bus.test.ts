/**
 * Unit tests for event-bus
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/redis", () => ({
    getRedis: vi.fn().mockReturnValue(null),
}));

import { eventBus } from "../event-bus";

describe("event-bus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("publish and subscribe", () => {
        it("should deliver events to subscribers", async () => {
            const handler = vi.fn();
            eventBus.subscribe("TEST_EVENT", handler);

            await eventBus.publish("test", "TEST_EVENT", { foo: "bar" });

            // Wait for async handler
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: "TEST_EVENT",
                    module: "test",
                    data: { foo: "bar" },
                })
            );
        });

        it("should support wildcard subscribers", async () => {
            const handler = vi.fn();
            eventBus.subscribe("*", handler);

            await eventBus.publish("test", "WILDCARD_EVENT", { data: 1 });

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(handler).toHaveBeenCalledTimes(1);
        });

        it("should generate unique event IDs", async () => {
            const payload1 = await eventBus.publish("test", "EVENT", {});
            const payload2 = await eventBus.publish("test", "EVENT", {});

            expect(payload1.eventId).not.toBe(payload2.eventId);
        });

        it("should include timestamp in payload", async () => {
            const payload = await eventBus.publish("test", "EVENT", {});

            expect(payload.timestamp).toBeDefined();
            expect(new Date(payload.timestamp).getTime()).not.toBeNaN();
        });

        it("should handle handler errors gracefully", async () => {
            const errorHandler = vi.fn().mockImplementation(() => {
                throw new Error("Handler error");
            });
            const normalHandler = vi.fn();

            eventBus.subscribe("ERROR_EVENT", errorHandler);
            eventBus.subscribe("ERROR_EVENT", normalHandler);

            await eventBus.publish("test", "ERROR_EVENT", {});

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(errorHandler).toHaveBeenCalled();
            expect(normalHandler).toHaveBeenCalled();
        });
    });

    describe("actorId", () => {
        it("should include actorId in payload", async () => {
            const handler = vi.fn();
            eventBus.subscribe("ACTOR_EVENT", handler);

            await eventBus.publish("test", "ACTOR_EVENT", {}, "user-123");

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({ actorId: "user-123" })
            );
        });
    });
});
