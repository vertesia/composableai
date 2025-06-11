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
        ...params
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
        log.warn(`Failed to notify webhook ${target_url}: ${err}`);
        throw new Error(`Failed to notify webhook ${target_url}: ${err}`);
    });

    if (!res.ok) {
        log.warn(`Failed to notify webhook ${target_url} - ${res.status}: ${res.statusText}`, { res });
        throw new Error(`Failed to notify webhook ${target_url}: ${res.statusText}`);
    }

    return { status: res.status, message: res.statusText, url: res.url }

}