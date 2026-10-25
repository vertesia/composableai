import { ApplicationFailure, log } from '@temporalio/activity';
import { decodeJWT, VertesiaClient } from '@vertesia/client';
import {
    ApiVersions,
    type AuthTokenPayload,
    type AuthTokenResponse,
    type DSLActivityExecutionPayload,
    type DSLActivitySpec,
    type WebHookSpec,
    type WorkflowExecutionBaseParams,
} from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { WorkflowParamNotFoundError } from '../errors.js';
import { safeFetch, URLValidationError } from '../security/ssrf.js';
import { getVertesiaClientOptions } from '../utils/client.js';

export interface NotifyWebhookParams {
    webhook: string | WebHookSpec; //URL to send the notification to
    workflow_id: string; //The ID of the workflow sending the notification
    workflow_type: string; //The type of workflow sending the notification (the wf function name)
    workflow_run_id: string; //The ID of the specific workflow run sending the notification
    event_name: string; //The event that triggered the notification (e.g. "completed", "failed", etc.)
    detail?: Record<string, unknown>; // additional data about the event if any. It will be send to the webhook when using POST
    body?: string; // raw request body. When set, it bypasses workflow notification payload formatting.
    //target_url: string; //URL to send the notification to
    method: 'GET' | 'POST'; //HTTP method to use
    headers?: Record<string, string>; // additional headers to send
    timeout_ms?: number;
    /** Authenticate a trusted app-hook request with the workflow token. */
    auth_mode?: 'vertesia';
}

export interface WebhookNotificationPayload {
    workflow_id: string;
    workflow_name: string;
    workflow_run_id: string;
    event_name: string;
    detail?: unknown;
}

export interface NotifyWebhook extends DSLActivitySpec<NotifyWebhookParams> {
    name: 'notifyWebhook';
}

export interface NotifyWebhookResult {
    status: number;
    message: string;
    url: string;
}

const APP_HOOK_TOKEN_REFRESH_THRESHOLD_MS = 5 * 60_000;

/**
 * Why a webhook request never got an answer, as plain log fields. Node's fetch rejects with a bare
 * `TypeError: fetch failed` and keeps the reason (ECONNREFUSED, ENOTFOUND, a connect timeout) on `cause`.
 */
/** Failure `type` of a webhook receiver that could not be reached (DNS, refused or reset connection, timeout). */
export const WEBHOOK_ENDPOINT_UNREACHABLE = 'WebhookEndpointUnreachable';
/** Failure `type` of a webhook receiver that answered with a non-2xx status. */
export const WEBHOOK_ENDPOINT_ERROR = 'WebhookEndpointError';

/**
 * Whether fetch failed on the way to the receiver: undici reports every network failure (DNS, refused or
 * reset connection, TLS) as `TypeError: fetch failed`, and the request timeout aborts it. Anything else,
 * such as an invalid header name, is rejected before the receiver is contacted.
 */
function isEndpointTransportFailure(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
    return err instanceof TypeError && err.message === 'fetch failed';
}

function describeFetchFailure(err: unknown): { error: string; cause?: string } {
    const error = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error ? (err.cause as { code?: unknown; message?: unknown } | undefined) : undefined;
    const detail = cause?.code ?? cause?.message;
    return typeof detail === 'string' ? { error, cause: detail } : { error };
}

export function webhookLogTarget(url: string): string {
    try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}`;
    } catch {
        return '[invalid webhook URL]';
    }
}

function validationStatusCode(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) {
        return undefined;
    }
    const record = error as { statusCode?: unknown; status?: unknown; code?: unknown };
    const status = record.statusCode ?? record.status ?? record.code;
    return typeof status === 'number' ? status : undefined;
}

function isNonRetryableUrlValidationError(error: unknown): boolean {
    const status = validationStatusCode(error);
    if (status !== undefined) {
        return status >= 400 && status < 500;
    }
    const message = error instanceof Error ? error.message : String(error);
    return /blocked|not allowed|forbidden|invalid url|internal hosts|private network|metadata/i.test(message);
}

export async function notifyWebhook(
    payload: DSLActivityExecutionPayload<NotifyWebhookParams>,
): Promise<NotifyWebhookResult> {
    const { params, client } = await setupActivity<NotifyWebhookParams>(payload);
    const { webhook, method, headers: defaultHeaders } = params;
    const appHookAuthToken =
        params.auth_mode === 'vertesia' ? await ensureFreshAppHookAuthToken(payload, client) : undefined;
    if (appHookAuthToken && appHookAuthToken !== payload.auth_token) {
        await client.withApiKey(appHookAuthToken);
    }
    // resolve the url and the api version of the webhook
    let target_url: string, version: number | undefined;
    if (typeof webhook === 'string') {
        target_url = webhook;
    } else {
        target_url = webhook.url;
        version = webhook.version;
    }

    if (!target_url) throw new WorkflowParamNotFoundError('target_url');
    const logTarget = webhookLogTarget(target_url);

    try {
        await client.apps.validateUrl(target_url);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (!isNonRetryableUrlValidationError(err)) {
            log.warn('URL validation preflight failed; retrying webhook notification', {
                url: logTarget,
                workflow_id: params.workflow_id,
                workflow_run_id: params.workflow_run_id,
                error: message,
            });
            throw err;
        }
        log.warn('URL validation blocked webhook endpoint', {
            url: logTarget,
            workflow_id: params.workflow_id,
            workflow_run_id: params.workflow_run_id,
            error: message,
        });
        throw ApplicationFailure.create({
            message: `Webhook endpoint blocked: ${message}`,
            nonRetryable: true,
        });
    }

    const hasBody = method === 'POST'; //body is sent only for POST, always includes workflow info

    const headers = {
        ...defaultHeaders,
    };
    if (hasBody && !hasHeader(headers, 'content-type')) {
        headers['Content-Type'] = 'application/json';
    }
    if (appHookAuthToken) {
        setHeader(headers, 'Authorization', `Bearer ${appHookAuthToken}`);
    }
    const body = params.body ?? (hasBody ? await createRequestBody(payload, params, version) : undefined);

    log.debug('Notifying webhook', { url: logTarget });
    const timeoutMs = typeof params.timeout_ms === 'number' && params.timeout_ms > 0 ? params.timeout_ms : undefined;
    const controller = timeoutMs ? new AbortController() : undefined;
    const timeout = timeoutMs ? setTimeout(() => controller?.abort(), timeoutMs) : undefined;
    let res: Response;
    try {
        res = await safeFetch(target_url, {
            method,
            body,
            headers,
            ...(controller ? { signal: controller.signal } : {}),
        }).catch((err: unknown) => {
            if (err instanceof URLValidationError) {
                log.warn('Redirect blocked on webhook endpoint', {
                    url: logTarget,
                    workflow_id: params.workflow_id,
                    workflow_run_id: params.workflow_run_id,
                    error: err.message,
                });
                throw ApplicationFailure.create({
                    message: `Webhook endpoint blocked: ${err.message}`,
                    nonRetryable: true,
                });
            }
            const failure = {
                url: logTarget,
                workflow_id: params.workflow_id,
                workflow_run_id: params.workflow_run_id,
                // The activity logger does not serialize an Error, so the cause rides as text.
                ...describeFetchFailure(err),
            };
            if (!isEndpointTransportFailure(err)) {
                // fetch rejected before reaching the receiver (e.g. an invalid header): the request is ours.
                log.error('An error occurred while notifying webhook', failure);
                throw err;
            }
            // The receiving endpoint could not be reached (DNS, refused or reset connection, timeout). That is
            // the receiver's availability, not a Vertesia failure, and the activity retries it: warn, like the
            // non-2xx answer below.
            log.warn('An error occurred while notifying webhook', failure);
            // Still retried. The type lets the workflow's failure log tell the receiver's outage from ours.
            throw ApplicationFailure.create({
                message: err instanceof Error ? err.message : String(err),
                type: WEBHOOK_ENDPOINT_UNREACHABLE,
                cause: err instanceof Error ? err : undefined,
            });
        });
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }

    if (!res.ok) {
        log.warn(`Webhook endpoint returned an error - ${res.status} ${res.statusText}`, {
            url: logTarget,
        });

        // Try to get response payload for error message
        let errorMessage = `Webhook Notification to ${logTarget} failed with status: ${res.status} ${res.statusText}`;
        try {
            const responseText = await readBoundedText(res, MAX_ERROR_BODY_BYTES);
            if (responseText) {
                errorMessage += ` - Response: ${responseText}`;
            }
        } catch (readError) {
            // If we can't read the response, just use the basic error message
            log.debug('Could not read response body for error', { readError });
        }

        throw ApplicationFailure.create({ message: errorMessage, type: WEBHOOK_ENDPOINT_ERROR });
    }

    return { status: res.status, message: res.statusText, url: res.url };
}

/** Upper bound on how much of a non-2xx webhook response is read into the error message. */
export const MAX_ERROR_BODY_BYTES = 64 * 1024;

/**
 * Reads at most `maxBytes` of the response body as text. The webhook endpoint is untrusted, so the body
 * is consumed as a stream and cancelled at the cap rather than buffered whole (`res.text()`) and sliced.
 */
export async function readBoundedText(res: Response, maxBytes: number): Promise<string> {
    if (!res.body) {
        return '';
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let truncated = false;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const remaining = maxBytes - received;
            if (value.byteLength > remaining) {
                chunks.push(value.subarray(0, remaining));
                truncated = true;
                break;
            }
            chunks.push(value);
            received += value.byteLength;
            if (received === maxBytes) {
                // Exactly at the cap: it is only truncated if more data follows.
                const next = await reader.read();
                truncated = !next.done;
                break;
            }
        }
    } finally {
        // Releases the connection without draining the rest of the body.
        await reader.cancel().catch(() => undefined);
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    return truncated ? `${text}… [truncated at ${maxBytes} bytes]` : text;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
    const lowerName = name.toLowerCase();
    return Object.keys(headers).some((header) => header.toLowerCase() === lowerName);
}

function setHeader(headers: Record<string, string>, name: string, value: string): void {
    const existingName = Object.keys(headers).find((header) => header.toLowerCase() === name.toLowerCase());
    if (existingName) {
        delete headers[existingName];
    }
    headers[name] = value;
}

export async function ensureFreshAppHookAuthToken(
    payload: WorkflowExecutionBaseParams<unknown>,
    client: VertesiaClient,
): Promise<string> {
    const currentToken = payload.auth_token;
    if (!currentToken) {
        throw new WorkflowParamNotFoundError('Authentication Token is missing from WorkflowExecutionPayload.authToken');
    }

    const claims = decodeJWT(currentToken);
    if (!shouldRefreshAppHookToken(claims)) {
        return currentToken;
    }

    const response = await refreshAppHookToken(client, currentToken);
    return response.token;
}

function shouldRefreshAppHookToken(claims: AuthTokenPayload): boolean {
    return claims.exp * 1000 - Date.now() < APP_HOOK_TOKEN_REFRESH_THRESHOLD_MS;
}

async function refreshAppHookToken(client: VertesiaClient, currentToken: string): Promise<AuthTokenResponse> {
    return client.post<AuthTokenResponse>(`${client.tokenServerUrl}/token/refresh`, {
        headers: {
            authorization: `Bearer ${currentToken}`,
            'content-type': 'application/json',
        },
        payload: { token: currentToken },
    });
}

// --------------------------------------
// Data provider for webhooks
// this allows to customize the payload sent to the webhook depending on the
// type of workflow and the api version of the webhook
// --------------------------------------

function getWorkflowName(workflowType: string): string {
    // remove trailing Workflow or _Workflow case insensitive from the workflow type
    return workflowType.replace(/_?workflow$/i, '');
}

async function createRequestBody(
    payload: WorkflowExecutionBaseParams<unknown>,
    params: NotifyWebhookParams,
    api_version: number | undefined,
): Promise<string> {
    // Like request payload validation, an omitted version selects the current API format.
    if (api_version !== undefined && Number(api_version) < ApiVersions.COMPLETION_RESULT_V1) {
        return createOldRequestBody(payload, params);
    } else {
        return createLatestRequestBody(payload, params, api_version);
    }
}

async function createLatestRequestBody(
    payload: WorkflowExecutionBaseParams<unknown>,
    params: NotifyWebhookParams,
    api_version: number | undefined,
): Promise<string> {
    const data = await createEventData(payload, params, api_version);
    return JSON.stringify({
        workflow_id: params.workflow_id,
        workflow_name: getWorkflowName(params.workflow_type),
        workflow_run_id: params.workflow_run_id,
        event_name: params.event_name,
        detail: data,
    } satisfies WebhookNotificationPayload);
}

async function createEventData(
    payload: WorkflowExecutionBaseParams<unknown>,
    params: NotifyWebhookParams,
    api_version: number | undefined,
): Promise<unknown> {
    const data = params.detail;
    const runId = typeof data?.run_id === 'string' ? data.run_id : undefined;
    if (runId && params.event_name === 'workflow_completed' && params.workflow_type === 'ExecuteInteractionWorkflow') {
        const client = getVersionedVertesiaClient(payload, api_version); //ensure client is initialized
        // we replace the result property with the full execution run object
        return await client.runs.retrieve(runId);
    }
    return data;
}

function getVersionedVertesiaClient(
    payload: WorkflowExecutionBaseParams<unknown>,
    version: string | number | undefined | null,
) {
    // set the api version header
    return new VertesiaClient(getVertesiaClientOptions(payload)).withApiVersion(version ? String(version) : null);
}

// ----------------- Compatibility code -----------------
/* Before 2025-10-08 the notifyWebhook POST body was in the format:

{
    "workflowId": "generation:ExecuteInteractionWorkflow:WhatColor:ox8wu6t4",
    "runId": "0199c2c6-818f-77eb-b931-c1ba8b9e5184",
    "status": "completed",
    "result": {
        "run_id": "68e616274b0e9bb510462378",
        "status": "completed",
        "result": {"Color": "white"}
    }
}

After Versions.COMPLETION_RESULT_V1  (20250925) when the completion result interface changed we improved the
payload to the current format:

{
    "workflow_id": "generation:ExecuteInteractionWorkflow:WhatColor:bdedqjqj6",
    "workflow_name": "ExecuteInteraction",
    "workflow_run_id": "0199c2d4-6b1d-7cf2-a1e5-4cac6778091e",
    "event_name": "workflow_completed",
    "detail": ExecutionRun
}

where ExecutionRun contains a result property with the new completion result format.

"result": [
    {
        "type": "json",
        "value": {
            "Color": "white"
        }
    }
],

*/

async function createOldRequestBody(
    payload: WorkflowExecutionBaseParams<unknown>,
    params: NotifyWebhookParams,
): Promise<string> {
    let data = params.detail;
    const runId = typeof data?.run_id === 'string' ? data.run_id : undefined;
    if (runId && params.event_name === 'workflow_completed' && params.workflow_type === 'ExecuteInteractionWorkflow') {
        const client = getVersionedVertesiaClient(payload, null); //ensure client is using no specific version
        // Important Note: we cannot use client.runs.retrieve since it will transform the run result to the new format because of InteractionOutput
        const run = await client.runs.get<{ id: string; status: string; result?: unknown }>(runId);
        // since we use an unversioned client the run will be in old format so we don't need to tranform the result
        const result = run.result;
        data = {
            workflowId: params.workflow_id,
            runId: params.workflow_run_id,
            status: params.event_name === 'workflow_completed' ? 'completed' : params.event_name,
            result: {
                run_id: run.id,
                status: run.status,
                result: result || null,
            },
        };
    } else {
        // Always include workflow metadata in old format, even when detail is undefined
        data = {
            workflowId: params.workflow_id,
            runId: params.workflow_run_id,
            status: params.event_name === 'workflow_completed' ? 'completed' : params.event_name,
            result: data || null,
        };
    }
    return JSON.stringify(data);
}
