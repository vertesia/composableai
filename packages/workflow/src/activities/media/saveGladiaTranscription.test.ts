import { MockActivityEnvironment } from "@temporalio/testing";
import { ContentEventName, DSLActivityExecutionPayload } from "@vertesia/common";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TextExtractionResult, TextExtractionStatus } from "../../result-types.js";
import { saveGladiaTranscription, SaveGladiaTranscriptionParams } from "./saveGladiaTranscription.js";

// Mock the FetchClient
vi.mock("@vertesia/api-fetch-client", () => ({
    FetchClient: vi.fn().mockImplementation(() => ({
        withHeaders: vi.fn().mockReturnThis(),
        get: vi.fn(),
    })),
    RequestError: class RequestError extends Error {
        status: number;
        constructor(message: string, status: number) {
            super(message);
            this.status = status;
        }
    }
}));

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
    objectId?: string
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
        const { FetchClient } = await import("@vertesia/api-fetch-client");
        const mockGladiaClient = {
            withHeaders: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockGladiaTranscriptionResult),
        };
        (FetchClient as any).mockImplementation(() => mockGladiaClient);

        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
        };

        const payload = createTestPayload(params, "test-object-id");
        const result = (await testEnv.run(saveGladiaTranscription, payload)) as TextExtractionResult;

        expect(result).toMatchObject({
            hasText: true,
            objectId: "test-object-id",
            status: TextExtractionStatus.success,
        });
        expect(result.message).toContain("saved with 2 segments");
    });

    it("should handle transcription in URL mode", async () => {
        const { FetchClient } = await import("@vertesia/api-fetch-client");
        const mockGladiaClient = {
            withHeaders: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockGladiaTranscriptionResult),
        };
        (FetchClient as any).mockImplementation(() => mockGladiaClient);

        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
            file_source: {
                source_url: "gs://test-bucket/audio.mp3",
                mimetype: "audio/mpeg",
                storage_path: "test-storage-path",
            },
        };

        const payload = createTestPayload(params);
        const result = (await testEnv.run(saveGladiaTranscription, payload)) as TextExtractionResult;

        expect(result).toMatchObject({
            hasText: true,
            objectId: "test-storage-path",
            status: TextExtractionStatus.success,
        });
        expect(result.message).toContain("completed with 2 segments");
    });

    it("should handle Gladia integration not enabled", async () => {
        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
        };

        const payload = createTestPayload(params, "test-object-id");
        const result = (await testEnv.run(saveGladiaTranscription, payload)) as TextExtractionResult;

        expect(result).toMatchObject({
            hasText: false,
            objectId: "test-object-id",
            status: TextExtractionStatus.error,
            error: "Gladia integration not enabled",
        });
    });

    it("should handle Gladia transcription error status", async () => {
        const { FetchClient } = await import("@vertesia/api-fetch-client");
        const mockGladiaClient = {
            withHeaders: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
                id: "test-transcription-id",
                status: "error",
            }),
        };
        (FetchClient as any).mockImplementation(() => mockGladiaClient);

        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
        };

        const payload = createTestPayload(params, "test-object-id");
        const result = (await testEnv.run(saveGladiaTranscription, payload)) as TextExtractionResult;

        expect(result).toMatchObject({
            hasText: false,
            objectId: "test-object-id",
            status: TextExtractionStatus.error,
            error: "Gladia transcription failed",
        });
    });

    it("should handle Gladia transcription not ready", async () => {
        const { FetchClient } = await import("@vertesia/api-fetch-client");
        const mockGladiaClient = {
            withHeaders: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
                id: "test-transcription-id",
                status: "processing",
            }),
        };
        (FetchClient as any).mockImplementation(() => mockGladiaClient);

        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
        };

        const payload = createTestPayload(params, "test-object-id");
        const result = (await testEnv.run(saveGladiaTranscription, payload)) as TextExtractionResult;

        expect(result).toMatchObject({
            hasText: false,
            objectId: "test-object-id",
            status: TextExtractionStatus.error,
        });
        expect(result.error).toContain("not ready: processing");
    });

    it("should handle empty transcript", async () => {
        const { FetchClient } = await import("@vertesia/api-fetch-client");
        const mockGladiaClient = {
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
        (FetchClient as any).mockImplementation(() => mockGladiaClient);

        const params: SaveGladiaTranscriptionParams = {
            gladiaTranscriptionId: "test-transcription-id",
        };

        const payload = createTestPayload(params, "test-object-id");
        const result = (await testEnv.run(saveGladiaTranscription, payload)) as TextExtractionResult;

        expect(result).toMatchObject({
            hasText: false,
            objectId: "test-object-id",
            status: TextExtractionStatus.success,
        });
    });
});
