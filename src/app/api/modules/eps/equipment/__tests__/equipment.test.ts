/**
 * Integration tests for equipment endpoints
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        equipment: {
            findMany: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        equipmentVersion: {
            create: vi.fn(),
        },
    },
}));

vi.mock("@/lib/auth/session", () => ({
    getSession: vi.fn(),
}));

vi.mock("@/lib/auth/eps-rbac", () => ({
    getUserEpsPermissions: vi.fn(),
}));

describe("Equipment API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("GET /api/modules/eps/equipment", () => {
        it("should return 401 for unauthenticated request", async () => {
            const { getSession } = await import("@/lib/auth/session");
            vi.mocked(getSession).mockResolvedValue(null);

            const { GET } = await import("@/app/api/modules/eps/equipment/route");

            const request = new Request("http://localhost/api/modules/eps/equipment");
            const response = await GET(request as any);

            expect(response.status).toBe(401);
        });

        it("should return equipment list for authenticated user", async () => {
            const { getSession } = await import("@/lib/auth/session");
            vi.mocked(getSession).mockResolvedValue({
                id: "user-1",
                email: "test@example.com",
                username: "test",
                displayName: "Test User",
                roles: ["VIEWER"],
            });

            const { prisma } = await import("@/lib/db/prisma");
            vi.mocked(prisma.equipment.findMany).mockResolvedValueOnce([]);
            vi.mocked(prisma.equipment.count).mockResolvedValueOnce(0);

            const { GET } = await import("@/app/api/modules/eps/equipment/route");

            const request = new Request("http://localhost/api/modules/eps/equipment");
            const response = await GET(request as any);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data?.items).toEqual([]);
            expect(data.data?.total).toBe(0);
        });

        it("should validate query parameters", async () => {
            const { getSession } = await import("@/lib/auth/session");
            vi.mocked(getSession).mockResolvedValue({
                id: "user-1",
                email: "test@example.com",
                username: "test",
                displayName: "Test User",
                roles: ["VIEWER"],
            });

            const { GET } = await import("@/app/api/modules/eps/equipment/route");

            const request = new Request(
                "http://localhost/api/modules/eps/equipment?limit=invalid"
            );
            const response = await GET(request as any);

            expect(response.status).toBe(400);
        });
    });

    describe("POST /api/modules/eps/equipment", () => {
        it("should return 403 for user without edit permission", async () => {
            const { getSession } = await import("@/lib/auth/session");
            vi.mocked(getSession).mockResolvedValue({
                id: "user-1",
                email: "viewer@example.com",
                username: "viewer",
                displayName: "Viewer",
                roles: ["VIEWER"],
            });

            const { getUserEpsPermissions } = await import("@/lib/auth/eps-rbac");
            vi.mocked(getUserEpsPermissions).mockResolvedValueOnce({
                canView: true,
                canEdit: false,
                canApprove: false,
                canDelete: false,
            });

            const { POST } = await import("@/app/api/modules/eps/equipment/route");

            const request = new Request("http://localhost/api/modules/eps/equipment", {
                method: "POST",
                body: JSON.stringify({ name: "Test Equipment" }),
                headers: { "Content-Type": "application/json" },
            });

            const response = await POST(request as any);

            expect(response.status).toBe(403);
        });

        it("should validate required fields", async () => {
            const { getSession } = await import("@/lib/auth/session");
            vi.mocked(getSession).mockResolvedValue({
                id: "user-1",
                email: "editor@example.com",
                username: "editor",
                displayName: "Editor",
                roles: ["EDITOR"],
            });

            const { getUserEpsPermissions } = await import("@/lib/auth/eps-rbac");
            vi.mocked(getUserEpsPermissions).mockResolvedValueOnce({
                canView: true,
                canEdit: true,
                canApprove: false,
                canDelete: false,
            });

            const { POST } = await import("@/app/api/modules/eps/equipment/route");

            const request = new Request("http://localhost/api/modules/eps/equipment", {
                method: "POST",
                body: JSON.stringify({}), // missing required name
                headers: { "Content-Type": "application/json" },
            });

            const response = await POST(request as any);

            expect(response.status).toBe(400);
        });
    });
});
