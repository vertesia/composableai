import { MockActivityEnvironment } from "@temporalio/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as activities from "./activities.js";
import {
    ActivityExecutionPayload,
    ProcessObjectParams,
    ProcessObjectResult,
} from "./activities.js";
import { getMockActivityPayload } from "./test/utils.js";

// Mock the @vertesia/workflow module
vi.mock("@vertesia/workflow", async () => {
    const actual = await vi.importActual("@vertesia/workflow");
    return {
        ...actual,
        getVertesiaClient: vi.fn(),
    };
});

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("processObjectActivity", () => {
    it("successfully processes an object", async () => {
        const mockObjectId = "test-object-id";
        const mockObjectName = "Test Document";

        // Mock the Vertesia client
        const { getVertesiaClient } = await import("@vertesia/workflow");
        vi.mocked(getVertesiaClient).mockReturnValue({
            objects: {
                retrieve: vi.fn().mockResolvedValue({
                    id: mockObjectId,
                    name: mockObjectName,
                }),
            },
        } as never);

        const env = new MockActivityEnvironment();
        const payload: ActivityExecutionPayload<ProcessObjectParams> =
            getMockActivityPayload({ objectId: mockObjectId });

        const result: ProcessObjectResult = await env.run(
            activities.processObjectActivity,
            payload
        );

        expect(result).toEqual({
            objectId: mockObjectId,
            name: mockObjectName,
            success: true,
        });
    });

    it("handles dry run mode", async () => {
        const mockObjectId = "test-object-id";
        const mockObjectName = "Test Document";

        // Mock the Vertesia client
        const { getVertesiaClient } = await import("@vertesia/workflow");
        vi.mocked(getVertesiaClient).mockReturnValue({
            objects: {
                retrieve: vi.fn().mockResolvedValue({
                    id: mockObjectId,
                    name: mockObjectName,
                }),
            },
        } as never);

        const env = new MockActivityEnvironment();
        const payload: ActivityExecutionPayload<ProcessObjectParams> = {
            ...getMockActivityPayload({ objectId: mockObjectId }),
            vars: { dryRun: true },
        };

        const result: ProcessObjectResult = await env.run(
            activities.processObjectActivity,
            payload
        );

        expect(result).toEqual({
            objectId: mockObjectId,
            name: mockObjectName,
            success: true,
            message: "Dry run - no changes made",
        });
    });
});

describe("getObjectMetadataActivity", () => {
    it("successfully retrieves object metadata", async () => {
        const mockObjectId = "test-object-id";
        const mockObject = {
            id: mockObjectId,
            name: "Test Document",
            type: { name: "Document" },
            properties: { author: "Test Author" },
        };

        // Mock the Vertesia client
        const { getVertesiaClient } = await import("@vertesia/workflow");
        vi.mocked(getVertesiaClient).mockReturnValue({
            objects: {
                retrieve: vi.fn().mockResolvedValue(mockObject),
            },
        } as never);

        const env = new MockActivityEnvironment();
        const payload: ActivityExecutionPayload<ProcessObjectParams> =
            getMockActivityPayload({ objectId: mockObjectId });

        const result = await env.run(
            activities.getObjectMetadataActivity,
            payload
        );

        expect(result).toEqual({
            objectId: mockObjectId,
            name: "Test Document",
            type: "Document",
            properties: { author: "Test Author" },
        });
    });

    it("handles objects without type or properties", async () => {
        const mockObjectId = "test-object-id";
        const mockObject = {
            id: mockObjectId,
            name: "Simple Document",
        };

        // Mock the Vertesia client
        const { getVertesiaClient } = await import("@vertesia/workflow");
        vi.mocked(getVertesiaClient).mockReturnValue({
            objects: {
                retrieve: vi.fn().mockResolvedValue(mockObject),
            },
        } as never);

        const env = new MockActivityEnvironment();
        const payload: ActivityExecutionPayload<ProcessObjectParams> =
            getMockActivityPayload({ objectId: mockObjectId });

        const result = await env.run(
            activities.getObjectMetadataActivity,
            payload
        );

        expect(result).toEqual({
            objectId: mockObjectId,
            name: "Simple Document",
            type: undefined,
            properties: {},
        });
    });
});
