import { log } from "@temporalio/activity";
import { DSLActivityExecutionPayload, DSLActivitySpec, ExecutionRun, WebHookSpec, WorkflowExecutionBaseParams } from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { WorkflowParamNotFoundError } from "../errors.js";
import { getVertesiaClient } from "../utils/client.js";
import { VertesiaClient } from "@vertesia/client";

export interface NotifyWebhookParams {
    workflow_type: string; //The type of workflow sending the notification (the wf function name)
    webhook: string | WebHookSpec; //URL to send the notification to
    //target_url: string; //URL to send the notification to
    method: 'GET' | 'POST'; //HTTP method to use
    payload: Record<string, any>; //payload to send (if POST then as JSON body, if GET then as query string)
    headers?: Record<string, string>; //additional headers to send
}


export interface NotifyWebhook extends DSLActivitySpec<NotifyWebhookParams> {
    name: 'notifyWebhook';
}


export async function notifyWebhook(payload: DSLActivityExecutionPayload<NotifyWebhookParams>) {

    const { params } = await setupActivity<NotifyWebhookParams>(payload);
    const { webhook, workflow_type, method, payload: requestPayload, headers } = params
    // resolve the url and the api version of the webhook
    let target_url: string, version: number | undefined;
    if (typeof webhook === 'string') {
        target_url = webhook;
    } else {
        target_url = webhook.url;
        version = webhook.version;
    }

    if (!target_url) throw new WorkflowParamNotFoundError('target_url');

    const body = method === 'POST' ? await createRequestBody(payload, workflow_type, version, requestPayload) : undefined

    log.info(`Notifying webhook at ${target_url}`);
    const res = await fetch(target_url, {
        method,
        body,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
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


async function createRequestBody(payload: WorkflowExecutionBaseParams, workflow_type: string, api_version: number | undefined, data?: any): Promise<string> {
    if (workflow_type === 'ExecuteInteractionWorkflow') {
        const client = getVertesiaClient(payload); //ensure client is initialized
        data = await fetchRun(client, data.run_id, api_version);
    }
    return JSON.stringify(data)
}

async function fetchRun(client: VertesiaClient, runId: string, version?: number): Promise<ExecutionRun> {
    return await client.runs.get(`/${runId}`, {
        headers: version ? {
            'X-Run-Version': version.toString()
        } : undefined
    });
}
