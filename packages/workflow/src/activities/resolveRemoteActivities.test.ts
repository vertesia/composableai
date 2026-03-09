import { MockActivityEnvironment } from "@temporalio/testing";
import { ContentEventName, DSLActivityExecutionPayload } from "@vertesia/common";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveRemoteActivities, ResolveRemoteActivitiesParams } from "./resolveRemoteActivities.js";

vi.stubGlobal("fetch", vi.fn());

// Mock getVertesiaClient
const mockGetInstalledApps = vi.fn();
vi.mock("../utils/client.js", () => ({
    getVertesiaClient: vi.fn().mockReturnValue({
        apps: {
            getInstalledApps: (...args: any[]) => mockGetInstalledApps(...args),
        },
    }),
}));

let testEnv: MockActivityEnvironment;
const mockFetch = vi.mocked(fetch);

beforeAll(async () => {
    testEnv = new MockActivityEnvironment();
});

beforeEach(() => {
    vi.clearAllMocks();
});

const createPayload = (): DSLActivityExecutionPayload<ResolveRemoteActivitiesParams> => ({
    auth_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbW9jay10b2tlbi1zZXJ2ZXIiLCJzdWIiOiJ0ZXN0In0.sig",
    account_id: "acc-123",
    project_id: "proj-456",
    params: {},
    config: {
        studio_url: "http://mock-studio",
        store_url: "http://mock-store",
    },
    workflow_name: "TestWorkflow",
    event: ContentEventName.create,
    objectIds: [],
    vars: {},
    activity: { name: "resolveRemoteActivities", params: {} },
});

describe("resolveRemoteActivities", () => {
    it("returns empty map when no apps installed", async () => {
        mockGetInstalledApps.mockResolvedValueOnce([]);

        const result = await testEnv.run(resolveRemoteActivities, createPayload());
        expect(result).toEqual({});
        expect(mockGetInstalledApps).toHaveBeenCalledWith("tools");
    });

    it("returns prefixed activity map from single app", async () => {
        mockGetInstalledApps.mockResolvedValueOnce([{
            id: "install-1",
            manifest: {
                name: "my-nlp-app",
                endpoint: "https://nlp-server.test/api/package",
            },
            settings: { api_key: "test" },
        }]);

        mockFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    activities: [
                        { name: "analyze_sentiment", description: "Analyze sentiment" },
                        { name: "extract_entities", description: "Extract entities" },
                    ],
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        );

        const result = await testEnv.run(resolveRemoteActivities, createPayload());

        expect(Object.keys(result)).toHaveLength(2);
        expect(result["my_nlp_app__analyze_sentiment"]).toBeDefined();
        expect(result["my_nlp_app__extract_entities"]).toBeDefined();

        const entry = result["my_nlp_app__analyze_sentiment"];
        expect(entry.activity_name).toBe("analyze_sentiment");
        expect(entry.app_name).toBe("my-nlp-app");
        expect(entry.app_install_id).toBe("install-1");
        expect(entry.app_settings).toEqual({ api_key: "test" });
        expect(entry.url).toContain("/activities");
    });

    it("merges activities from multiple apps", async () => {
        mockGetInstalledApps.mockResolvedValueOnce([
            {
                id: "install-1",
                manifest: { name: "app-one", endpoint: "https://one.test/api/package" },
            },
            {
                id: "install-2",
                manifest: { name: "app-two", endpoint: "https://two.test/api/package" },
            },
        ]);

        mockFetch
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ activities: [{ name: "task_a" }] }), { status: 200 }),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ activities: [{ name: "task_b" }] }), { status: 200 }),
            );

        const result = await testEnv.run(resolveRemoteActivities, createPayload());

        expect(Object.keys(result)).toHaveLength(2);
        expect(result["app_one__task_a"]).toBeDefined();
        expect(result["app_two__task_b"]).toBeDefined();
    });

    it("skips app with no activities", async () => {
        mockGetInstalledApps.mockResolvedValueOnce([{
            id: "install-1",
            manifest: { name: "empty-app", endpoint: "https://empty.test/api/package" },
        }]);

        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ activities: [] }), { status: 200 }),
        );

        const result = await testEnv.run(resolveRemoteActivities, createPayload());
        expect(result).toEqual({});
    });

    it("skips app with no endpoint", async () => {
        mockGetInstalledApps.mockResolvedValueOnce([{
            id: "install-1",
            manifest: { name: "no-endpoint" },
        }]);

        const result = await testEnv.run(resolveRemoteActivities, createPayload());
        expect(result).toEqual({});
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("handles duplicate prefixed names across apps (first wins)", async () => {
        mockGetInstalledApps.mockResolvedValueOnce([
            {
                id: "install-1",
                manifest: { name: "same-app", endpoint: "https://one.test/api/package" },
            },
            {
                id: "install-2",
                manifest: { name: "same-app", endpoint: "https://two.test/api/package" },
            },
        ]);

        mockFetch
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ activities: [{ name: "task" }] }), { status: 200 }),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ activities: [{ name: "task" }] }), { status: 200 }),
            );

        const result = await testEnv.run(resolveRemoteActivities, createPayload());
        expect(Object.keys(result)).toHaveLength(1);
        expect(result["same_app__task"].app_install_id).toBe("install-1");
    });

    it("continues with other apps when one fetch fails", async () => {
        mockGetInstalledApps.mockResolvedValueOnce([
            {
                id: "install-1",
                manifest: { name: "failing-app", endpoint: "https://fail.test/api/package" },
            },
            {
                id: "install-2",
                manifest: { name: "working-app", endpoint: "https://work.test/api/package" },
            },
        ]);

        mockFetch
            .mockRejectedValueOnce(new Error("Connection refused"))
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ activities: [{ name: "task" }] }), { status: 200 }),
            );

        const result = await testEnv.run(resolveRemoteActivities, createPayload());
        expect(Object.keys(result)).toHaveLength(1);
        expect(result["working_app__task"]).toBeDefined();
    });

    it("returns empty map when getInstalledApps fails", async () => {
        mockGetInstalledApps.mockRejectedValueOnce(new Error("API error"));

        const result = await testEnv.run(resolveRemoteActivities, createPayload());
        expect(result).toEqual({});
    });
});
