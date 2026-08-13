/**
 * Unit tests for cron-engine
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/redis", () => ({
    getRedis: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        equipment: {
            findMany: vi.fn().mockResolvedValue([]),
        },
    },
}));

import { ShellCronEngine } from "../cron-engine";

describe("cron-engine", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("registerTask", () => {
        it("should register a new task", () => {
            const taskId = "test_task_" + Date.now();
            ShellCronEngine.registerTask({
                id: taskId,
                name: "Test Task",
                module: "TEST",
                scheduleIntervalMs: 60000,
                status: "idle",
                handler: async () => ({ success: true }),
            });

            const summary = ShellCronEngine.getTasksSummary();
            const task = summary.find((t) => t.id === taskId);

            expect(task).toBeDefined();
            expect(task?.name).toBe("Test Task");
            expect(task?.module).toBe("TEST");
        });
    });

    describe("getTasksSummary", () => {
        it("should return all registered tasks", () => {
            const summary = ShellCronEngine.getTasksSummary();

            expect(summary).toBeInstanceOf(Array);
            expect(summary.length).toBeGreaterThan(0);
        });

        it("should include default tasks", () => {
            const summary = ShellCronEngine.getTasksSummary();
            const taskIds = summary.map((t) => t.id);

            expect(taskIds).toContain("eps_service_due_check");
            expect(taskIds).toContain("wms_min_stock_alert");
            expect(taskIds).toContain("shell_cleanup_logs");
        });

        it("should convert interval to minutes", () => {
            const summary = ShellCronEngine.getTasksSummary();
            const epsTask = summary.find((t) => t.id === "eps_service_due_check");

            expect(epsTask?.intervalMinutes).toBe(60); // 1 hour
        });
    });

    describe("runTask", () => {
        it("should execute task handler successfully", async () => {
            const taskId = "test_run_" + Date.now();
            ShellCronEngine.registerTask({
                id: taskId,
                name: "Test Run",
                module: "TEST",
                scheduleIntervalMs: 60000,
                status: "idle",
                handler: async () => ({ result: "ok" }),
            });

            const result = await ShellCronEngine.runTask(taskId);

            expect(result).toEqual({ result: "ok" });
        });

        it("should throw error for unknown task", async () => {
            await expect(ShellCronEngine.runTask("nonexistent_task")).rejects.toThrow(
                "не найдена"
            );
        });

        it("should mark task as error on failure", async () => {
            const taskId = "test_fail_" + Date.now();
            ShellCronEngine.registerTask({
                id: taskId,
                name: "Test Fail",
                module: "TEST",
                scheduleIntervalMs: 60000,
                status: "idle",
                handler: async () => {
                    throw new Error("Task failed");
                },
            });

            await expect(ShellCronEngine.runTask(taskId)).rejects.toThrow("Task failed");

            const summary = ShellCronEngine.getTasksSummary();
            const task = summary.find((t) => t.id === taskId);

            expect(task?.status).toBe("error");
        });
    });
});
