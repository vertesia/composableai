import { log } from "@temporalio/activity";
import { VertesiaClient } from "@vertesia/client";
import { ApiVersions, DSLActivityExecutionPayload, DSLActivitySpec, WebHookSpec, WorkflowExecutionBaseParams } from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { WorkflowParamNotFoundError } from "../errors.js";
import { getVertesiaClientOptions } from "../utils/client.js";

export interface NotifyWebhookParams {
    webhook: string | WebHookSpec; //URL to send the notification to
    workflow_id: string; //The ID of the workflow sending the notification
    workflow_type: string; //The type of workflow sending the notification (the wf function name)
    workflow_run_id: string; //The ID of the specific workflow run sending the notification
    event_name: string; //The event that triggered the notification (e.g. "completed", "failed", etc.)
    detail?: Record<string, any>; // additional data about the event if any. It will be send to the webhook when using POST 
    //target_url: string; //URL to send the notification to
    method: 'GET' | 'POST'; //HTTP method to use
    headers?: Record<string, string>; // additional headers to send
}

export interface WebhookNotificationPayload {
    workflow_id: string,
    workflow_name: string,
    workflow_run_id: string,
    event_name: string,
    detail?: Record<string, any>,
}

export interface NotifyWebhook extends DSLActivitySpec<NotifyWebhookParams> {
    name: 'notifyWebhook';
}


export async function notifyWebhook(payload: DSLActivityExecutionPayload<NotifyWebhookParams>) {

    const { params } = await setupActivity<NotifyWebhookParams>(payload);
    const { webhook, method, headers: defaultHeaders } = params
    // resolve the url and the api version of the webhook
    let target_url: string, version: number | undefined;
    if (typeof webhook === 'string') {
        target_url = webhook;
    } else {
        target_url = webhook.url;
        version = webhook.version;
    }

    if (!target_url) throw new WorkflowParamNotFoundError('target_url');

    const hasBody = params.detail && method === 'POST'; //body is sent only for POST

    const headers = {
        ...defaultHeaders,
    };
    if (hasBody) {
        headers['Content-Type'] = 'application/json';
    }
    const body = hasBody ? await createRequestBody(payload, params, version) : undefined

    log.info(`Notifying webhook at ${target_url}`);
    const res = await fetch(target_url, {
        method,
        body,
        headers,
    }).catch(err => {
        log.error(`An error occurred while notifying webhook at ${target_url}`, { err });
        throw err;
    });

    if (!res.ok) {
        log.warn(`Webhook endpoint ${target_url} returned an error - ${res.status} ${res.statusText}`, { fetchResponse: res });

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

    return { status: res.status, message: res.statusText, url: res.url }

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

async function createRequestBody(payload: WorkflowExecutionBaseParams, params: NotifyWebhookParams, api_version: number | undefined): Promise<string> {
    if (api_version === undefined || Number(api_version) < ApiVersions.COMPLETION_RESULT_V1) {
        return createOldRequestBody(payload, params);
    } else {
        return createLatestRequestBody(payload, params, api_version);
    }
}

async function createLatestRequestBody(payload: WorkflowExecutionBaseParams, params: NotifyWebhookParams, api_version: number | undefined): Promise<string> {
    const data = await createEventData(payload, params, api_version);
    return JSON.stringify({
        workflow_id: params.workflow_id,
        workflow_name: getWorkflowName(params.workflow_type),
        workflow_run_id: params.workflow_run_id,
        event_name: params.event_name,
        detail: data,
    } satisfies WebhookNotificationPayload);
}

async function createEventData(payload: WorkflowExecutionBaseParams, params: NotifyWebhookParams, api_version: number | undefined): Promise<any> {
    const data = params.detail;
    if (data && data.run_id && params.event_name === "workflow_completed" && params.workflow_type === 'ExecuteInteractionWorkflow') {
        const client = getVersionedVertesiaClient(payload, api_version); //ensure client is initialized
        // we replace the result property with the full execution run object
        return await client.runs.retrieve(data.run_id);
    }
    return data;
}


function getVersionedVertesiaClient(payload: WorkflowExecutionBaseParams, version: string | number | undefined | null) {
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

//@ts-ignore
async function createOldRequestBody(payload: WorkflowExecutionBaseParams, params: NotifyWebhookParams): Promise<string> {
    let data = params.detail;
    if (data && data.run_id && params.event_name === "workflow_completed" && params.workflow_type === 'ExecuteInteractionWorkflow') {
        const client = getVersionedVertesiaClient(payload, null); //ensure client is using no specific version
        // we cannot use retrieve since it will transform the run result to the new format because of InteractionOutput
        const run = await client.runs.get(data.run_id);
        // since we use an unversioned client the run will be in old format so we don't need to tranform the result
        const result = run.result;
        data = {
            workflowId: params.workflow_id,
            runId: params.workflow_run_id,
            status: params.event_name === 'workflow_completed' ? 'completed' : params.event_name,
            result: {
                run_id: run.id,
                status: run.status,
                result: result || null
            }
        };
    }
    return JSON.stringify(data || {});
}