import {
  MockActivityEnvironment,
} from "@temporalio/testing";
import { ContentEventName, DSLActivityExecutionPayload } from "@vertesia/common";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyWebhook, NotifyWebhookParams } from "./notifyWebhook.js";

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());

let testEnv: MockActivityEnvironment;
const mockFetch = vi.mocked(fetch);

beforeAll(async () => {
  testEnv = new MockActivityEnvironment();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const defaultParams = {
  webhook: "https://vertesia.test",
  method: "POST" as const,
  detail: { message: "Hello World" },
  workflow_id: "wf_id",
  workflow_type: "wfFuncName",
  workflow_run_id: "wf_run_id",
  event_name: "completed",
} satisfies NotifyWebhookParams;

// Helper function to create test payload
const createTestPayload = (params: Partial<NotifyWebhookParams> = {}): DSLActivityExecutionPayload<NotifyWebhookParams> => {
  const mergedParams = { ...defaultParams, ...params };
  return {
    auth_token: "unset",
    account_id: "unset",
    project_id: "unset",
    params: mergedParams,
    config: {
      studio_url: "http://mock-studio",
      store_url: "http://mock-store",
    },
    workflow_name: "",
    event: ContentEventName.create,
    objectIds: [],
    vars: {},
    activity: { name: "notifyWebhook", params: mergedParams }
  };
};

describe("Webhook should be notified", () => {
  it("test POST success", async () => {
    // Mock successful response
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      url: defaultParams.webhook
    };
    mockFetch.mockResolvedValueOnce(mockResponse as Response);

    const payload = createTestPayload();
    const res = await testEnv.run(notifyWebhook, payload);

    // Verify fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(defaultParams.webhook, {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello World' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Verify response
    expect(res).toEqual({
      status: 200,
      message: 'OK',
      url: defaultParams.webhook
    });
  });

  it("test POST server error", async () => {
    // Mock error response with response body
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      url: defaultParams.webhook,
      text: vi.fn().mockResolvedValue('{"error": "Database connection failed", "code": "DB_ERROR"}')
    } as unknown as Response;
    mockFetch.mockResolvedValueOnce(mockResponse);

    const payload = createTestPayload();

    // Expect the function to throw an error with response payload
    await expect(testEnv.run(notifyWebhook, payload)).rejects.toThrow(
      `Webhook Notification to ${defaultParams.webhook} failed with status: 500 Internal Server Error - Response: {"error": "Database connection failed", "code": "DB_ERROR"}`
    );

    // Verify fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(defaultParams.webhook, {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello World' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Verify that text() was called to read the response
    expect(mockResponse.text).toHaveBeenCalled();
  });

  it("test POST network error", async () => {
    // Mock fetch to throw a network error
    const networkError = new Error('Network request failed');
    mockFetch.mockRejectedValueOnce(networkError);

    const payload = createTestPayload();

    // Expect the function to throw the network error
    await expect(testEnv.run(notifyWebhook, payload)).rejects.toThrow('Network request failed');

    // Verify fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(defaultParams.webhook, {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello World' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

});
