import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { ActivityCollection, ActivityDefinition } from "../ActivityCollection.js";
import { createActivitiesRoute } from "./activities.js";
import { ToolServerConfig } from "./types.js";

// Mock authorize to avoid JWT verification
vi.mock("../auth.js", () => ({
    authorize: vi.fn().mockResolvedValue({ token: "test-token" }),
    AuthSession: vi.fn(),
}));

const mockActivity: ActivityDefinition = {
    name: "analyze_sentiment",
    title: "Analyze Sentiment",
    description: "Analyzes text sentiment",
    input_schema: { type: "object", properties: { text: { type: "string" } } },
    run: vi.fn().mockResolvedValue({ score: 0.95 }),
};

const mockActivity2: ActivityDefinition = {
    name: "extract_entities",
    description: "Extracts entities",
    run: vi.fn().mockResolvedValue({ entities: ["foo"] }),
};

function createApp(activities: ActivityCollection[] = []) {
    const app = new Hono();
    const config = { activities } as ToolServerConfig;
    createActivitiesRoute(app, "/api/activities", config);
    return app;
}

function createTestCollections() {
    const coll1 = new ActivityCollection({
        name: "nlp",
        description: "NLP activities",
        activities: [mockActivity],
    });
    const coll2 = new ActivityCollection({
        name: "extraction",
        description: "Extraction activities",
        activities: [mockActivity2],
    });
    return [coll1, coll2];
}

describe("Activities server routes", () => {
    describe("GET /api/activities", () => {
        it("returns all activity definitions across collections", async () => {
            const app = createApp(createTestCollections());
            const res = await app.request("/api/activities");
            const body = await res.json() as any;

            expect(res.status).toBe(200);
            expect(body.activities).toHaveLength(2);
            expect(body.activities[0].name).toBe("analyze_sentiment");
            expect(body.activities[1].name).toBe("extract_entities");
            expect(body.collections).toHaveLength(2);
        });

        it("returns empty when no collections configured", async () => {
            const app = createApp([]);
            const res = await app.request("/api/activities");
            const body = await res.json() as any;

            expect(res.status).toBe(200);
            expect(body.activities).toHaveLength(0);
        });
    });

    describe("GET /api/activities/{collection}", () => {
        it("returns activities for a specific collection", async () => {
            const app = createApp(createTestCollections());
            const res = await app.request("/api/activities/nlp");
            const body = await res.json() as any;

            expect(res.status).toBe(200);
            expect(body.name).toBe("nlp");
            expect(body.activities).toHaveLength(1);
            expect(body.activities[0].name).toBe("analyze_sentiment");
        });
    });

    describe("POST /api/activities", () => {
        it("executes activity by name", async () => {
            const app = createApp(createTestCollections());
            const res = await app.request("/api/activities", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer test-token",
                },
                body: JSON.stringify({
                    activity_name: "analyze_sentiment",
                    params: { text: "hello" },
                    metadata: {
                        workflow_name: "wf",
                        account_id: "acc",
                        project_id: "proj",
                    },
                }),
            });

            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.result).toEqual({ score: 0.95 });
            expect(body.is_error).toBe(false);
        });

        it("returns 404 for unknown activity name", async () => {
            const app = createApp(createTestCollections());
            const res = await app.request("/api/activities", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer test-token",
                },
                body: JSON.stringify({
                    activity_name: "nonexistent",
                    params: {},
                    metadata: {},
                }),
            });

            expect(res.status).toBe(404);
        });

        it("returns 400 for missing activity_name", async () => {
            const app = createApp(createTestCollections());
            const res = await app.request("/api/activities", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer test-token",
                },
                body: JSON.stringify({ params: {} }),
            });

            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/activities/{collection}", () => {
        it("routes to correct collection", async () => {
            const app = createApp(createTestCollections());
            const res = await app.request("/api/activities/extraction", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer test-token",
                },
                body: JSON.stringify({
                    activity_name: "extract_entities",
                    params: {},
                    metadata: {},
                }),
            });

            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.result).toEqual({ entities: ["foo"] });
        });
    });
});
