import {
  MockActivityEnvironment,
} from "@temporalio/testing";
import { ApiVersions, ContentEventName, DSLActivityExecutionPayload, WebHookSpec } from "@vertesia/common";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyWebhook, NotifyWebhookParams, WebhookNotificationPayload } from "./notifyWebhook.js";

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
    auth_token: process.env.VERTESIA_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbW9jay10b2tlbi1zZXJ2ZXIiLCJzdWIiOiJ0ZXN0In0.signature",
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

    // Verify fetch was called with correct parameters (old format wraps detail in result)
    expect(mockFetch).toHaveBeenCalledWith(defaultParams.webhook, {
      method: 'POST',
      body: JSON.stringify({
        workflowId: 'wf_id',
        runId: 'wf_run_id',
        status: 'completed',
        result: { message: 'Hello World' }
      }),
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

    // Verify fetch was called with correct parameters (old format wraps detail in result)
    expect(mockFetch).toHaveBeenCalledWith(defaultParams.webhook, {
      method: 'POST',
      body: JSON.stringify({
        workflowId: 'wf_id',
        runId: 'wf_run_id',
        status: 'completed',
        result: { message: 'Hello World' }
      }),
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

    // Verify fetch was called with correct parameters (old format wraps detail in result)
    expect(mockFetch).toHaveBeenCalledWith(defaultParams.webhook, {
      method: 'POST',
      body: JSON.stringify({
        workflowId: 'wf_id',
        runId: 'wf_run_id',
        status: 'completed',
        result: { message: 'Hello World' }
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it("test POST with undefined detail still sends body with workflow info (new format)", async () => {
    // Mock successful response
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://vertesia.test'
    };
    mockFetch.mockResolvedValueOnce(mockResponse as Response);

    // Create webhook spec with version to use new format
    const webhookSpec: WebHookSpec = {
      url: 'https://vertesia.test',
      version: ApiVersions.COMPLETION_RESULT_V1
    };

    // Create payload with undefined detail (like workflow_failed events)
    const payload = createTestPayload({
      webhook: webhookSpec,
      detail: undefined,
      event_name: 'workflow_failed'
    });

    const res = await testEnv.run(notifyWebhook, payload);

    // Verify fetch was called
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [_url, options] = mockFetch.mock.calls[0];

    // Verify the body parameter is NOT undefined
    expect(options?.body).toBeDefined();

    // Verify the body contains workflow info
    const bodyData = JSON.parse(options?.body as string) as WebhookNotificationPayload;
    expect(bodyData.workflow_id).toBe('wf_id');
    expect(bodyData.workflow_name).toBe('wfFuncName');
    expect(bodyData.workflow_run_id).toBe('wf_run_id');
    expect(bodyData.event_name).toBe('workflow_failed');
    // detail should not be present when undefined (JSON.stringify omits it)
    expect(bodyData.detail).toBeUndefined();

    // Verify Content-Type header is set
    const headers = options?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');

    // Verify response
    expect(res).toEqual({
      status: 200,
      message: 'OK',
      url: webhookSpec.url
    });
  });

  it("test POST with undefined detail still sends body with workflow info (old format)", async () => {
    // Mock successful response
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://vertesia.test'
    };
    mockFetch.mockResolvedValueOnce(mockResponse as Response);

    // Create payload with string webhook (old format) and undefined detail
    const payload = createTestPayload({
      webhook: 'https://vertesia.test',
      detail: undefined,
      event_name: 'workflow_completed'
    });

    const res = await testEnv.run(notifyWebhook, payload);

    // Verify fetch was called
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [_url, options] = mockFetch.mock.calls[0];

    // Verify the body parameter is NOT undefined
    expect(options?.body).toBeDefined();

    // Verify the body contains workflow info in old format
    const bodyData = JSON.parse(options?.body as string);
    expect(bodyData.workflowId).toBe('wf_id');
    expect(bodyData.runId).toBe('wf_run_id');
    expect(bodyData.status).toBe('completed');
    expect(bodyData.result).toBeNull(); // null when detail is undefined

    // Verify Content-Type header is set
    const headers = options?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');

    // Verify response
    expect(res).toEqual({
      status: 200,
      message: 'OK',
      url: 'https://vertesia.test'
    });
  });

});
