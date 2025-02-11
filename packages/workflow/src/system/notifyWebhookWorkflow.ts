
import { log } from "@temporalio/workflow";
import { ContentEventName, WorkflowExecutionPayload } from "@vertesia/common";
import * as activities from "../activities/notifyWebhook.js";
import { dslProxyActivities } from "../dsl/dslProxyActivities.js";

const {
    notifyWebhook
} = dslProxyActivities<typeof activities>("notifyWebhookWorkflow", {
    startToCloseTimeout: "5 minute",
    retry: {
        initialInterval: '5s',
        backoffCoefficient: 2,
        maximumAttempts: 5,
        maximumInterval: 100 * 30 * 1000, //ms
        nonRetryableErrorTypes: [],
    },
});


export async function notifyWebhookWorkflow(payload: WorkflowExecutionPayload): Promise<any> {

    const { objectIds, vars } = payload;
    const notifications = [];
    const endpoints = vars?.webhooks || [];
    const eventName = vars.event || ContentEventName.workflow_finished;

    if (!endpoints.length) {
        log.info(`No webhooks to notify`);
        return { notifications: [], message: "No webhooks to notify" };
    }

    for (const ep of endpoints) {
        const n = notifyWebhook(payload, {
            target_url: ep,
            method: 'POST',
            payload: {
                object_ids: objectIds,
                event: eventName,
                data: vars.webhook_data ?? undefined,
                vars
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
