
import { log, workflowInfo } from "@temporalio/workflow";
import { WebHookSpec, WorkflowExecutionPayload } from "@vertesia/common";
import * as activities from "../activities/notifyWebhook.js";
import { dslProxyActivities } from "../dsl/dslProxyActivities.js";
import { WF_NON_RETRYABLE_ERRORS } from "../errors.js";

const {
    notifyWebhook
} = dslProxyActivities<typeof activities>("notifyWebhookWorkflow", {
    startToCloseTimeout: "5 minute",
    retry: {
        initialInterval: '5s',
        backoffCoefficient: 2,
        maximumAttempts: 5,
        maximumInterval: 100 * 30 * 1000, //ms
        nonRetryableErrorTypes: WF_NON_RETRYABLE_ERRORS,
    },
});

export interface NotifyWebhookWorfklowParams {
    workflow_type: string;
    endpoints: (string | WebHookSpec)[],
    data: Record<string, any>
}


export async function notifyWebhookWorkflow(payload: WorkflowExecutionPayload<NotifyWebhookWorfklowParams>): Promise<any> {

    const { objectIds, vars } = payload;
    const notifications = [];
    const endpoints = vars.endpoints ?? (vars as any).webhooks ?? [];
    const data = vars.data ?? (vars as any).webhook_data ?? undefined;
    const workflow_type = vars.workflow_type ?? workflowInfo().workflowType;
    const eventName = payload.event;

    if (!endpoints.length) {
        log.info(`No webhooks to notify`);
        return { notifications: [], message: "No webhooks to notify" };
    }

    for (const ep of endpoints) {
        const n = notifyWebhook(payload, {
            webhook: ep,
            workflow_type,
            method: 'POST',
            payload: {
                object_ids: objectIds,
                event: eventName,
                data
            }
        }).then(res => {
            log.info(`Webhook notified at ${ep} with response code: ${res.status}`, { res });
            return res;
        });
        notifications.push(n);
    }

    const res = await Promise.all(notifications);
    log.info(`Webhooks notified`);

    return { notifications: res, message: "Webhooks notified" };

}
