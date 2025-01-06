
import { ContentEventName, DSLWorkflowExecutionPayload } from "@vertesia/common";
import { log, proxyActivities } from "@temporalio/workflow";
import * as activities from "../activities/index.js";

const {
    notifyWebhook
} = proxyActivities<typeof activities>({
    startToCloseTimeout: "5 minute",
    retry: {
        initialInterval: '5s',
        backoffCoefficient: 2,
        maximumAttempts: 5,
        maximumInterval: 100 * 30 * 1000, //ms
        nonRetryableErrorTypes: [],
    },
});


interface NotifyWebhookWorkflowParams extends DSLWorkflowExecutionPayload {
}

export async function notifyWebhookWorkflow(payload: NotifyWebhookWorkflowParams): Promise<any> {

    const { objectIds, vars } = payload;
    const notifications = [];
    const endpoints = vars?.webhooks || [];
    const eventName = vars.event || ContentEventName.workflow_finished;

    if (!endpoints.length) {
        log.info(`No webhooks to notify`);
        return { notifications: [], message: "No webhooks to notify" };
    }

    for (const ep of endpoints) {
        const n = notifyWebhook({
            ...payload,
            activity: {
                name: "notifyWebhook",
            } ,
            params: {
                target_url: ep,
                method: 'POST',
                payload: {
                    object_ids: objectIds,
                    event: eventName,
                    data: vars.webhook_data ?? undefined,
                    vars
                }
            },
            workflow_name: "Notify Webhook",
        } ).then(res => {
            log.info(`Webhook notified at ${ep} with response code: ${res.status}`, { res });
            return res;
        });
        notifications.push(n);
    }

    const res = await Promise.all(notifications);
    log.info(`Webhooks notified`);

    return { notifications: res, message: "Webhooks notified" };

}
