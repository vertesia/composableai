import { ApplicationFailure, log } from '@temporalio/activity';
import { VertesiaClient } from '@vertesia/client';
import {
    ApiVersions,
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

export async function notifyWebhook(
    payload: DSLActivityExecutionPayload<NotifyWebhookParams>,
): Promise<NotifyWebhookResult> {
    const { params, client } = await setupActivity<NotifyWebhookParams>(payload);
    const { webhook, method, headers: defaultHeaders } = params;
    // resolve the url and the api version of the webhook
    let target_url: string, version: number | undefined;
    if (typeof webhook === 'string') {
        target_url = webhook;
    } else {
        target_url = webhook.url;
        version = webhook.version;
    }

    if (!target_url) throw new WorkflowParamNotFoundError('target_url');

    try {
        await client.apps.validateUrl(target_url);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn('URL validation blocked webhook endpoint', {
            url: target_url,
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
    const body = params.body ?? (hasBody ? await createRequestBody(payload, params, version) : undefined);

    log.info(`Notifying webhook at ${target_url}`);
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
                    url: target_url,
                    workflow_id: params.workflow_id,
                    workflow_run_id: params.workflow_run_id,
                    error: err.message,
                });
                throw ApplicationFailure.create({
                    message: `Webhook endpoint blocked: ${err.message}`,
                    nonRetryable: true,
                });
            }
            log.error(`An error occurred while notifying webhook at ${target_url}`, { err });
            throw err;
        });
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }

    if (!res.ok) {
        log.warn(`Webhook endpoint ${target_url} returned an error - ${res.status} ${res.statusText}`, {
            fetchResponse: res,
        });

        // Try to get response payload for error message
        let errorMessage = `Webhook Notification to ${target_url} failed with status: ${res.status} ${res.statusText}`;
        try {
            const responseText = await res.text();
            if (responseText) {
                errorMessage += ` - Response: ${responseText}`;
            }
        } catch (readError) {
            // If we can't read the response, just use the basic error message
            log.debug('Could not read response body for error', { readError });
        }

        throw new Error(errorMessage);
    }

    return { status: res.status, message: res.statusText, url: res.url };
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
    const lowerName = name.toLowerCase();
    return Object.keys(headers).some((header) => header.toLowerCase() === lowerName);
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
    if (api_version === undefined || Number(api_version) < ApiVersions.COMPLETION_RESULT_V1) {
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
