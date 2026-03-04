import { CompleteAsyncError } from "@temporalio/activity";
import { MockActivityEnvironment } from "@temporalio/testing";
import type { VertesiaClient } from "@vertesia/client";
import { AUDIO_RENDITION_NAME, ContentEventName, ContentNature, DSLActivityExecutionPayload } from "@vertesia/common";
import type { ActivityContext } from "@vertesia/workflow";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TextExtractionStatus } from "../../result-types.js";
import { transcribeMedia, TranscriptMediaParams, TranscriptMediaResult } from "./transcribeMediaWithGladia.js";

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
    params: TranscriptMediaParams,
    objectId?: string,
    fileInput?: { url: string; mimetype: string }
): DSLActivityExecutionPayload<TranscriptMediaParams> => {
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
        activity: { name: "TranscribeMedia", params }
    };
};

describe("TranscribeMedia", () => {
    it("should send transcription request in object mode", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");
        const { FetchClient } = await import("@vertesia/api-fetch-client");

        const mockFetchClient = {
            withHeaders: vi.fn().mockReturnThis(),
            post: vi.fn().mockResolvedValue({
                id: "test-transcription-id",
                result_url: "https://api.gladia.io/v2/transcription/test-transcription-id",
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
                    content: {
                        source: "gs://test-bucket/audio.mp3",
                        type: "audio/mpeg",
                    },
                    text: null,
                }),
            },
            files: {
                getDownloadUrl: vi.fn().mockResolvedValue({
                    url: "https://download.example.com/audio.mp3",
                }),
            },
            store: {
                baseUrl: "http://mock-store",
            },
        } as unknown as VertesiaClient;

        const params: TranscriptMediaParams = {};

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<TranscriptMediaParams>);

        const payload = createTestPayload(params, "test-object-id");

        await expect(testEnv.run(transcribeMedia, payload)).rejects.toThrow(CompleteAsyncError);

        expect(mockFetchClient.post).toHaveBeenCalledWith("/transcription", {
            payload: {
                audio_url: "https://download.example.com/audio.mp3",
                callback_url: expect.stringContaining("http://mock-store/webhooks/gladia?task_token="),
                diarization_enhanced: true,
                enable_code_switching: true,
                subtitles: true,
                subtitles_config: {
                    formats: ["vtt"],
                },
            },
        });
    });

    it("should use audio rendition for video objects", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");
        const { FetchClient } = await import("@vertesia/api-fetch-client");

        const mockFetchClient = {
            withHeaders: vi.fn().mockReturnThis(),
            post: vi.fn().mockResolvedValue({
                id: "test-transcription-id",
                result_url: "https://api.gladia.io/v2/transcription/test-transcription-id",
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
                    content: {
                        source: "gs://test-bucket/video.mp4",
                        type: "video/mp4",
                    },
                    metadata: {
                        type: ContentNature.Video,
                        renditions: [
                            {
                                name: AUDIO_RENDITION_NAME,
                                content: {
                                    source: "gs://test-bucket/audio-rendition.mp3",
                                },
                            },
                        ],
                    },
                    text: null,
                }),
            },
            files: {
                getDownloadUrl: vi.fn().mockResolvedValue({
                    url: "https://download.example.com/audio-rendition.mp3",
                }),
            },
            store: {
                baseUrl: "http://mock-store",
            },
        } as unknown as VertesiaClient;

        const params: TranscriptMediaParams = {};

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-video-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<TranscriptMediaParams>);

        const payload = createTestPayload(params, "test-video-id");

        await expect(testEnv.run(transcribeMedia, payload)).rejects.toThrow(CompleteAsyncError);

        // Should use audio rendition source
        expect(mockClient.files.getDownloadUrl).toHaveBeenCalledWith("gs://test-bucket/audio-rendition.mp3");
    });

    it("should skip transcription when text already exists", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");

        const mockClient = {
            projects: {
                integrations: {
                    retrieve: vi.fn().mockResolvedValue({
                        enabled: true,
                        api_key: "test-api-key",
                    }),
                },
            },
            objects: {
                retrieve: vi.fn().mockResolvedValue({
                    content: {
                        source: "gs://test-bucket/audio.mp3",
                    },
                    text: "Existing transcription text",
                }),
            },
        } as unknown as VertesiaClient;

        const params: TranscriptMediaParams = {};

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<TranscriptMediaParams>);

        const payload = createTestPayload(params, "test-object-id");
        const result: TranscriptMediaResult = await testEnv.run(transcribeMedia, payload);

        expect(result).toMatchObject({
            hasText: true,
            objectId: "test-object-id",
            status: TextExtractionStatus.skipped,
            message: "text already present and force not enabled",
        });
    });

    it("should force transcription when force=true", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");
        const { FetchClient } = await import("@vertesia/api-fetch-client");

        const mockFetchClient = {
            withHeaders: vi.fn().mockReturnThis(),
            post: vi.fn().mockResolvedValue({
                id: "test-transcription-id",
                result_url: "https://api.gladia.io/v2/transcription/test-transcription-id",
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
                    content: {
                        source: "gs://test-bucket/audio.mp3",
                    },
                    text: "Existing transcription text",
                }),
            },
            files: {
                getDownloadUrl: vi.fn().mockResolvedValue({
                    url: "https://download.example.com/audio.mp3",
                }),
            },
            store: {
                baseUrl: "http://mock-store",
            },
        } as unknown as VertesiaClient;

        const params: TranscriptMediaParams = {
            force: true,
        };

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<TranscriptMediaParams>);

        const payload = createTestPayload(params, "test-object-id");

        await expect(testEnv.run(transcribeMedia, payload)).rejects.toThrow(CompleteAsyncError);

        expect(mockFetchClient.post).toHaveBeenCalled();
    });

    it("should send transcription request in file mode", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");
        const { FetchClient } = await import("@vertesia/api-fetch-client");

        const mockFetchClient = {
            withHeaders: vi.fn().mockReturnThis(),
            post: vi.fn().mockResolvedValue({
                id: "test-transcription-id",
                result_url: "https://api.gladia.io/v2/transcription/test-transcription-id",
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
            files: {
                getDownloadUrl: vi.fn().mockResolvedValue({
                    url: "https://download.example.com/audio.mp3",
                }),
            },
            store: {
                baseUrl: "http://mock-store",
            },
        } as unknown as VertesiaClient;

        const params: TranscriptMediaParams = {
            output_storage_path: "test-storage-path",
        };

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            file: { url: "gs://test-bucket/audio.mp3", mimetype: "audio/mpeg" },
            inputType: 'files',
            params,
        } as unknown as ActivityContext<TranscriptMediaParams>);

        const payload = createTestPayload(
            params,
            undefined,
            { url: "gs://test-bucket/audio.mp3", mimetype: "audio/mpeg" }
        );

        await expect(testEnv.run(transcribeMedia, payload)).rejects.toThrow(CompleteAsyncError);

        expect(mockClient.files.getDownloadUrl).toHaveBeenCalledWith("gs://test-bucket/audio.mp3");
        expect(mockFetchClient.post).toHaveBeenCalled();
    });

    it("should throw error when output_storage_path is missing in file mode", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");

        const mockClient = {
            projects: {
                integrations: {
                    retrieve: vi.fn().mockResolvedValue({
                        enabled: true,
                        api_key: "test-api-key",
                    }),
                },
            },
        } as unknown as VertesiaClient;

        const params: TranscriptMediaParams = {};

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            file: { url: "gs://test-bucket/audio.mp3", mimetype: "audio/mpeg" },
            inputType: 'files',
            params,
        } as unknown as ActivityContext<TranscriptMediaParams>);

        const payload = createTestPayload(
            params,
            undefined,
            { url: "gs://test-bucket/audio.mp3", mimetype: "audio/mpeg" }
        );

        await expect(testEnv.run(transcribeMedia, payload)).rejects.toThrow(
            "output_storage_path is required when using file input"
        );
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

        const params: TranscriptMediaParams = {};

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<TranscriptMediaParams>);

        const payload = createTestPayload(params, "test-object-id");
        const result: TranscriptMediaResult = await testEnv.run(transcribeMedia, payload);

        expect(result).toMatchObject({
            hasText: false,
            objectId: "test-object-id",
            status: TextExtractionStatus.error,
            error: "Gladia integration not enabled",
        });
    });

    it("should handle missing source in object mode", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");

        const mockClient = {
            projects: {
                integrations: {
                    retrieve: vi.fn().mockResolvedValue({
                        enabled: true,
                        api_key: "test-api-key",
                    }),
                },
            },
            objects: {
                retrieve: vi.fn().mockResolvedValue({
                    content: null,
                }),
            },
        } as unknown as VertesiaClient;

        const params: TranscriptMediaParams = {};

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<TranscriptMediaParams>);

        const payload = createTestPayload(params, "test-object-id");

        await expect(testEnv.run(transcribeMedia, payload)).rejects.toThrow(
            "No source found for object test-object-id"
        );
    });

    it("should handle Gladia 422 error", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");
        const { FetchClient, RequestError } = await import("@vertesia/api-fetch-client");

        // Create a mock Request object
        const mockRequest = new Request("https://api.gladia.io/v2/transcription", {
            method: "POST",
        });

        const mockFetchClient = {
            withHeaders: vi.fn().mockReturnThis(),
            post: vi.fn().mockRejectedValue(
                new RequestError("Invalid audio format", mockRequest, 422, { error: "Invalid audio format" })
            ),
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
                    content: {
                        source: "gs://test-bucket/audio.mp3",
                    },
                    text: null,
                }),
            },
            files: {
                getDownloadUrl: vi.fn().mockResolvedValue({
                    url: "https://download.example.com/audio.mp3",
                }),
            },
            store: {
                baseUrl: "http://mock-store",
            },
        } as unknown as VertesiaClient;

        const params: TranscriptMediaParams = {};

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<TranscriptMediaParams>);

        const payload = createTestPayload(params, "test-object-id");
        const result: TranscriptMediaResult = await testEnv.run(transcribeMedia, payload);

        expect(result).toMatchObject({
            hasText: false,
            objectId: "test-object-id",
            status: TextExtractionStatus.error,
            error: expect.stringContaining("Gladia transcription error"),
        });
    });

    it("should handle missing download URL", async () => {
        const { setupActivity } = await import("../../dsl/setup/ActivityContext.js");

        const mockClient = {
            projects: {
                integrations: {
                    retrieve: vi.fn().mockResolvedValue({
                        enabled: true,
                        api_key: "test-api-key",
                    }),
                },
            },
            objects: {
                retrieve: vi.fn().mockResolvedValue({
                    content: {
                        source: "gs://test-bucket/audio.mp3",
                    },
                    text: null,
                }),
            },
            files: {
                getDownloadUrl: vi.fn().mockResolvedValue({
                    url: null,
                }),
            },
        } as unknown as VertesiaClient;

        const params: TranscriptMediaParams = {};

        vi.mocked(setupActivity).mockResolvedValue({
            client: mockClient,
            objectId: "test-object-id",
            inputType: 'objectIds',
            params,
        } as unknown as ActivityContext<TranscriptMediaParams>);

        const payload = createTestPayload(params, "test-object-id");

        await expect(testEnv.run(transcribeMedia, payload)).rejects.toThrow(
            "Error fetching media URL"
        );
    });
});
