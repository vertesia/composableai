import { RemoteActivityExecutionPayload } from "@vertesia/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityCollection, ActivityDefinition } from "./ActivityCollection.js";

vi.mock("./auth.js", () => ({
    authorize: vi.fn().mockResolvedValue({ token: "test-token" }),
}));

const mockActivity: ActivityDefinition = {
    name: "analyze_sentiment",
    title: "Analyze Sentiment",
    description: "Analyzes text sentiment",
    input_schema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
    },
    output_schema: {
        type: "object",
        properties: { score: { type: "number" } },
    },
    run: vi.fn().mockResolvedValue({ score: 0.95 }),
};

const mockFailingActivity: ActivityDefinition = {
    name: "fail_always",
    description: "Always fails",
    run: vi.fn().mockRejectedValue(new Error("Intentional failure")),
};

function createCollection(activities: ActivityDefinition[] = [mockActivity]) {
    return new ActivityCollection({
        name: "test-collection",
        title: "Test Collection",
        description: "A test collection",
        activities,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("ActivityCollection", () => {
    describe("getActivityDefinitions", () => {
        it("returns correct metadata for all registered activities", () => {
            const coll = createCollection([mockActivity, mockFailingActivity]);
            const defs = coll.getActivityDefinitions();

            expect(defs).toHaveLength(2);
            expect(defs[0]).toEqual({
                name: "analyze_sentiment",
                title: "Analyze Sentiment",
                description: "Analyzes text sentiment",
                input_schema: mockActivity.input_schema,
                output_schema: mockActivity.output_schema,
            });
            expect(defs[1]).toEqual({
                name: "fail_always",
                title: undefined,
                description: "Always fails",
                input_schema: undefined,
                output_schema: undefined,
            });
        });

        it("returns empty array when no activities registered", () => {
            const coll = createCollection([]);
            expect(coll.getActivityDefinitions()).toEqual([]);
        });
    });

    describe("getActivity", () => {
        it("returns the activity by name", () => {
            const coll = createCollection();
            const activity = coll.getActivity("analyze_sentiment");
            expect(activity.name).toBe("analyze_sentiment");
            expect(activity.run).toBeDefined();
        });

        it("throws 404 for unknown activity name", () => {
            const coll = createCollection();
            expect(() => coll.getActivity("nonexistent")).toThrow();
        });
    });

    describe("iterator", () => {
        it("iterates over all activities", () => {
            const coll = createCollection([mockActivity, mockFailingActivity]);
            const names = [...coll].map(a => a.name);
            expect(names).toEqual(["analyze_sentiment", "fail_always"]);
        });
    });

    describe("execute", () => {
        const createMockContext = () => {
            const jsonFn = vi.fn().mockReturnThis();
            return {
                json: jsonFn,
                req: {
                    header: vi.fn().mockReturnValue("Bearer test-token"),
                    url: "http://localhost/api/activities",
                },
                set: vi.fn(),
            } as any;
        };

        const payload: RemoteActivityExecutionPayload = {
            activity_name: "analyze_sentiment",
            params: { text: "Hello world" },
            metadata: {
                app_install_id: "install-1",
            },
        };

        it("calls the correct activity handler and returns result", async () => {
            const coll = createCollection();
            const ctx = createMockContext();

            await coll.execute(ctx, payload);

            expect(mockActivity.run).toHaveBeenCalledWith(
                payload,
                expect.objectContaining({ token: "test-token" }),
            );
            expect(ctx.json).toHaveBeenCalledWith({
                result: { score: 0.95 },
                is_error: false,
            });
        });

        it("returns is_error with message when activity throws", async () => {
            const coll = createCollection([mockFailingActivity]);
            const ctx = createMockContext();

            const failPayload: RemoteActivityExecutionPayload = {
                ...payload,
                activity_name: "fail_always",
            };

            await coll.execute(ctx, failPayload);

            expect(ctx.json).toHaveBeenCalledWith(
                { result: null, is_error: true, error: "Intentional failure" },
                500,
            );
        });

        it("throws 404 when activity_name is not found", async () => {
            const coll = createCollection();
            const ctx = createMockContext();

            const unknownPayload: RemoteActivityExecutionPayload = {
                ...payload,
                activity_name: "nonexistent",
            };

            await expect(coll.execute(ctx, unknownPayload)).rejects.toThrow();
        });
    });
});
