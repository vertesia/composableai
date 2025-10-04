import { log } from "@temporalio/activity";
import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { WorkflowParamNotFoundError } from "../errors.js";

export interface NotifyWebhookParams {
    target_url: string; //URL to send the notification to
    method: 'GET' | 'POST'; //HTTP method to use
    payload: Record<string, any>; //payload to send (if POST then as JSON body, if GET then as query string)
    headers?: Record<string, string>; //additional headers to send
}


export interface NotifyWebhook extends DSLActivitySpec<NotifyWebhookParams> {
    name: 'notifyWebhook';
}


export async function notifyWebhook(payload: DSLActivityExecutionPayload<NotifyWebhookParams>) {

    const { params } = await setupActivity<NotifyWebhookParams>(payload);
    const { target_url, method, payload: requestPayload, headers } = params

    if (!target_url) throw new WorkflowParamNotFoundError('target_url');

    const body = method === 'POST' ? JSON.stringify({
        ...requestPayload,
    }) : undefined

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
