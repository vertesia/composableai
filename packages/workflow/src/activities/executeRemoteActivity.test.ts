import { MockActivityEnvironment } from "@temporalio/testing";
import { ContentEventName, DSLActivityExecutionPayload } from "@vertesia/common";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { executeRemoteActivity, ExecuteRemoteActivityParams } from "./executeRemoteActivity.js";

vi.stubGlobal("fetch", vi.fn());

let testEnv: MockActivityEnvironment;
const mockFetch = vi.mocked(fetch);

beforeAll(async () => {
    testEnv = new MockActivityEnvironment();
});

beforeEach(() => {
    vi.clearAllMocks();
});

const createPayload = (
    overrides: Partial<ExecuteRemoteActivityParams> = {},
): DSLActivityExecutionPayload<ExecuteRemoteActivityParams> => {
    const params: ExecuteRemoteActivityParams = {
        url: "https://tool-server.test/api/activities",
        activity_name: "analyze_sentiment",
        params: { text: "Hello world" },
        app_install_id: "install-123",
        app_name: "nlp-app",
        ...overrides,
    };
    return {
        auth_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbW9jay10b2tlbi1zZXJ2ZXIiLCJzdWIiOiJ0ZXN0In0.sig",
        account_id: "acc-123",
        project_id: "proj-456",
        params,
        config: {
            studio_url: "http://mock-studio",
            store_url: "http://mock-store",
        },
        workflow_name: "TestWorkflow",
        event: ContentEventName.create,
        objectIds: [],
        vars: {},
        activity: { name: "executeRemoteActivity", params },
    };
};

describe("executeRemoteActivity", () => {
    it("posts correct payload and returns result on success", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({ result: { score: 0.95 }, is_error: false }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        );

        const result = await testEnv.run(executeRemoteActivity, createPayload());
        expect(result).toEqual({ score: 0.95 });

        expect(mockFetch).toHaveBeenCalledOnce();
        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toBe("https://tool-server.test/api/activities");
        expect(opts?.method).toBe("POST");
        expect(opts?.headers).toMatchObject({
            "Content-Type": "application/json",
            Accept: "application/json",
        });
        // Verify the auth header is forwarded
        expect((opts?.headers as Record<string, string>)["Authorization"]).toMatch(/^Bearer /);

        // Verify the body structure
        const body = JSON.parse(opts?.body as string);
        expect(body.activity_name).toBe("analyze_sentiment");
        expect(body.params).toEqual({ text: "Hello world" });
        expect(body.metadata.app_install_id).toBe("install-123");
        expect(body.metadata.endpoints).toEqual({ studio: "http://mock-studio", store: "http://mock-store" });
        // auth_token should NOT be in the payload (it's in the Authorization header)
        expect(body.auth_token).toBeUndefined();
    });

    it("throws on HTTP error (4xx/5xx)", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({ error: "Activity not found", is_error: true }),
                { status: 404, statusText: "Not Found" },
            ),
        );

        await expect(testEnv.run(executeRemoteActivity, createPayload())).rejects.toThrow(
            "Remote activity analyze_sentiment failed: Activity not found",
        );
    });

    it("throws on network error (for Temporal retry)", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

        await expect(testEnv.run(executeRemoteActivity, createPayload())).rejects.toThrow(
            /Failed to reach remote activity endpoint/,
        );
    });

    it("throws on invalid JSON response", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response("not json", { status: 200 }),
        );

        await expect(testEnv.run(executeRemoteActivity, createPayload())).rejects.toThrow(
            /returned invalid JSON/,
        );
    });

    it("throws when response indicates is_error", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({ result: null, is_error: true, error: "Something went wrong" }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        );

        await expect(testEnv.run(executeRemoteActivity, createPayload())).rejects.toThrow(
            "Remote activity analyze_sentiment: Something went wrong",
        );
    });

    it("forwards app_settings in metadata", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({ result: "ok", is_error: false }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        );

        await testEnv.run(
            executeRemoteActivity,
            createPayload({ app_settings: { api_key: "secret" } }),
        );

        const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
        expect(body.metadata.app_settings).toEqual({ api_key: "secret" });
    });
});
