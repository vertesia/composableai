import { MockActivityEnvironment } from "@temporalio/testing";
import { ContentEventName, DSLActivityExecutionPayload } from "@vertesia/common";
import type { VertesiaClient } from "@vertesia/client";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityContext, TextExtractionResult } from "@vertesia/workflow";
import { TextExtractionStatus } from "../../result-types.js";
import { saveGladiaTranscription, SaveGladiaTranscriptionParams } from "./saveGladiaTranscription.js";

// Mock setupActivity from the relative path used by the activity
vi.mock("../../dsl/setup/ActivityContext.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../dsl/setup/ActivityContext.js")>();
    return {
        ...actual,
        setupActivity: vi.fn(),
    };
});

// Mock FetchClient as a constructor
vi.mock("@vertesia/api-fetch-client", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@vertesia/api-fetch-client")>();
    return {
        ...actual,
        FetchClient: vi.fn(),
    };
});

let testEnv: MockActivityEnvironment;

beforeAll(async () => {
    testEnv = new MockActivityEnvironment();
});

beforeEach(() => {
    vi.clearAllMocks();
});

// Helper function to create test payload
const createTestPayload = (
    params: SaveGladiaTranscriptionParams,
    objectId?: string,
    fileInput?: { url: string; mimetype: string }
): DSLActivityExecutionPayload<SaveGladiaTranscriptionParams> => {
    return {
        auth_token: process.env.VERTESIA_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbW9jay10b2tlbi1zZXJ2ZXIiLCJzdWIiOiJ0ZXN0In0.signature",
        account_id: "test-account",
        project_id: "test-project",
        params,
        config: {
            studio_url: "http://mock-studio",
            store_url: "http://mock-store",
        },
        workflow_name: "test-workflow",
        event: ContentEventName.create,
        objectIds: objectId ? [objectId] : [],
        input: fileInput
            ? { inputType: 'files' as const, files: [fileInput] }
            : objectId
            ? { inputType: 'objectIds' as const, objectIds: [objectId] }
            : undefined,
        vars: {},
        activity: { name: "SaveGladiaTranscription", params }
    };
};

// Mock Gladia transcription response
const mockGladiaTranscriptionResult = {
    id: "test-transcription-id",
    status: "done" as const,
    result: {
        metadata: {
            audio_duration: 120.5,
            number_of_distinct_channels: 1,
            billing_time: 120,
            transcription_time: 30,
        },
        transcription: {
            full_transcript: "Hello world, this is a test transcription.",
            languages: ["en"],
            utterances: [
                {
                    language: "en",
                    start: 0,
                    end: 2.5,
                    confidence: 0.95,
                    channel: 0,
                    speaker: 0,
                    text: "Hello world,"
                },
                {
                    language: "en",
                    start: 2.5,
                    end: 5.0,
                    confidence: 0.97,
                    channel: 0,
                    speaker: 0,
                    text: "this is a test transcription."
                }
            ],
        },
    },
};

describe("SaveGladiaTranscription", () => {
    it("should save transcription in object mode", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");
        const { FetchClient } = await import("@vertesia/api-fetch-client");

        // Mock FetchClient instance
        const mockFetchClient = {
            withHeaders: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockGladiaTranscriptionResult),
        };
        vi.mocked(FetchClient).mockImplementation(function(this: any) {
            return mockFetchClient as any;
        });

        // Mock client
        const mockClient = {
            projects: {
                integrations: {
                    retrieve: vi.fn().mockResolvedValue({
                        enabled: true,
                        api_key: "test-api-key",
                        url: "https://api.gladia.io/v2",
                    }),
                },
            },
            objects: {
                retrieve: vi.fn().mockResolvedValue({
                    content: { etag: "test-etag" },
                }),
                update: vi.fn().mockResolvedValue({}),
            },
        } as unknown as VertesiaClient;

        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
        };

        // Mock setupActivity
        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<SaveGladiaTranscriptionParams>);

        const payload = createTestPayload(params, "test-object-id");
        const result: TextExtractionResult = await testEnv.run(saveGladiaTranscription, payload);

        expect(result).toMatchObject({
            hasText: true,
            objectId: "test-object-id",
            status: TextExtractionStatus.success,
        });
        expect(result.message).toContain("saved with 2 segments");
    });

    it("should handle transcription in file mode", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");
        const { FetchClient } = await import("@vertesia/api-fetch-client");

        const mockFetchClient = {
            withHeaders: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockGladiaTranscriptionResult),
        };
        vi.mocked(FetchClient).mockImplementation(function(this: any) {
            return mockFetchClient as any;
        });

        const mockClient = {
            projects: {
                integrations: {
                    retrieve: vi.fn().mockResolvedValue({
                        enabled: true,
                        api_key: "test-api-key",
                        url: "https://api.gladia.io/v2",
                    }),
                },
            },
            files: {
                uploadText: vi.fn().mockResolvedValue({}),
            },
        } as unknown as VertesiaClient;

        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
            output_storage_path: "test-storage-path",
        };

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            file: { url: "gs://test-bucket/audio.mp3", mimetype: "audio/mpeg" },
            inputType: 'files',
            params,
        } as unknown as ActivityContext<SaveGladiaTranscriptionParams>);

        const payload = createTestPayload(
            params,
            undefined,
            { url: "gs://test-bucket/audio.mp3", mimetype: "audio/mpeg" }
        );
        const result: TextExtractionResult = await testEnv.run(saveGladiaTranscription, payload);

        expect(result).toMatchObject({
            hasText: true,
            objectId: "test-storage-path",
            status: TextExtractionStatus.success,
        });
        expect(result.message).toContain("completed with 2 segments");
    });

    it("should handle Gladia integration not enabled", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");

        const mockClient = {
            projects: {
                integrations: {
                    retrieve: vi.fn().mockResolvedValue({
                        enabled: false,
                    }),
                },
            },
        } as unknown as VertesiaClient;

        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
        };

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<SaveGladiaTranscriptionParams>);

        const payload = createTestPayload(params, "test-object-id");
        const result: TextExtractionResult = await testEnv.run(saveGladiaTranscription, payload);

        expect(result).toMatchObject({
            hasText: false,
            objectId: "test-object-id",
            status: TextExtractionStatus.error,
            error: "Gladia integration not enabled",
        });
    });

    it("should handle Gladia transcription error status", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");
        const { FetchClient } = await import("@vertesia/api-fetch-client");

        const mockFetchClient = {
            withHeaders: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
                id: "test-transcription-id",
                status: "error",
            }),
        };
        vi.mocked(FetchClient).mockImplementation(function(this: any) {
            return mockFetchClient as any;
        });

        const mockClient = {
            projects: {
                integrations: {
                    retrieve: vi.fn().mockResolvedValue({
                        enabled: true,
                        api_key: "test-api-key",
                        url: "https://api.gladia.io/v2",
                    }),
                },
            },
        } as unknown as VertesiaClient;

        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
        };

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<SaveGladiaTranscriptionParams>);

        const payload = createTestPayload(params, "test-object-id");
        const result: TextExtractionResult = await testEnv.run(saveGladiaTranscription, payload);

        expect(result).toMatchObject({
            hasText: false,
            objectId: "test-object-id",
            status: TextExtractionStatus.error,
            error: "Gladia transcription failed",
        });
    });

    it("should handle Gladia transcription not ready", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");
        const { FetchClient } = await import("@vertesia/api-fetch-client");

        const mockFetchClient = {
            withHeaders: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
                id: "test-transcription-id",
                status: "processing",
            }),
        };
        vi.mocked(FetchClient).mockImplementation(function(this: any) {
            return mockFetchClient as any;
        });

        const mockClient = {
            projects: {
                integrations: {
                    retrieve: vi.fn().mockResolvedValue({
                        enabled: true,
                        api_key: "test-api-key",
                        url: "https://api.gladia.io/v2",
                    }),
                },
            },
        } as unknown as VertesiaClient;

        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
        };

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<SaveGladiaTranscriptionParams>);

        const payload = createTestPayload(params, "test-object-id");
        const result: TextExtractionResult = await testEnv.run(saveGladiaTranscription, payload);

        expect(result).toMatchObject({
            hasText: false,
            objectId: "test-object-id",
            status: TextExtractionStatus.error,
        });
        expect(result.error).toContain("not ready: processing");
    });

    it("should handle empty transcript", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");
        const { FetchClient } = await import("@vertesia/api-fetch-client");

        const mockFetchClient = {
            withHeaders: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
                ...mockGladiaTranscriptionResult,
                result: {
                    ...mockGladiaTranscriptionResult.result,
                    transcription: {
                        full_transcript: "",
                        languages: [],
                        utterances: [],
                    },
                },
            }),
        };
        vi.mocked(FetchClient).mockImplementation(function(this: any) {
            return mockFetchClient as any;
        });

        const mockClient = {
            projects: {
                integrations: {
                    retrieve: vi.fn().mockResolvedValue({
                        enabled: true,
                        api_key: "test-api-key",
                        url: "https://api.gladia.io/v2",
                    }),
                },
            },
            objects: {
                retrieve: vi.fn().mockResolvedValue({
                    content: { etag: "test-etag" },
                }),
                update: vi.fn().mockResolvedValue({}),
            },
        } as unknown as VertesiaClient;

        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
        };

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<SaveGladiaTranscriptionParams>);

        const payload = createTestPayload(params, "test-object-id");
        const result: TextExtractionResult = await testEnv.run(saveGladiaTranscription, payload);

        expect(result).toMatchObject({
            hasText: false,
            objectId: "test-object-id",
            status: TextExtractionStatus.success,
        });
    });
});
