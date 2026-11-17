import { ActivityFailure, ApplicationFailure, isCancellation, log, workflowInfo } from '@temporalio/workflow';
import type { WebHookSpec, WorkflowExecutionPayload } from '@vertesia/common';
import type * as activities from '../activities/notifyWebhook.js';
import { dslProxyActivities } from '../dsl/dslProxyActivities.js';
import { WF_NON_RETRYABLE_ERRORS } from '../errors.js';
import { webhookLogTarget } from '../utils/webhookLogTarget.js';

const { notifyWebhook } = dslProxyActivities<typeof activities>('notifyWebhookWorkflow', {
    startToCloseTimeout: '5 minute',
    retry: {
        initialInterval: '5s',
        backoffCoefficient: 2,
        maximumAttempts: 5,
        maximumInterval: 100 * 30 * 1000, //ms
        nonRetryableErrorTypes: WF_NON_RETRYABLE_ERRORS,
    },
});

/** Failure type of a run in which at least one notification failed. The first failure is its `cause`. */
export const WEBHOOK_NOTIFICATIONS_FAILED = 'WebhookNotificationsFailed';

export interface NotifyWebhookWorfklowParams {
    workflow_type?: string;
    endpoints?: (string | WebHookSpec)[];
    data?: Record<string, unknown>;
    requests?: NotifyWebhookRequest[];
}

export interface NotifyWebhookRequest {
    url: string;
    body: string;
    headers?: Record<string, string>;
    timeout_ms?: number;
    /** Authenticate a trusted app-hook request with the workflow token. */
    auth_mode?: 'vertesia';
}

export async function notifyWebhookWorkflow(
    payload: WorkflowExecutionPayload<NotifyWebhookWorfklowParams>,
): Promise<unknown> {
    const info = workflowInfo();
    const { objectIds, vars } = payload;
    const notifications = [];
    const targets: string[] = [];
    const legacyVars = vars as NotifyWebhookWorfklowParams & {
        webhooks?: (string | WebHookSpec)[];
        webhook_data?: Record<string, unknown>;
    };
    const endpoints = legacyVars.endpoints ?? legacyVars.webhooks ?? [];
    const requests = legacyVars.requests ?? [];
    const data = legacyVars.data ?? legacyVars.webhook_data ?? undefined;
    const workflow_type = vars.workflow_type ?? info.workflowType;
    const eventName = payload.event;

    const workflowId = info.parent?.workflowId || info.workflowId;
    const workflowRunId = info.parent?.runId || info.runId;

    if (!endpoints.length && !requests.length) {
        log.info(`No webhooks to notify`);
        return { notifications: [], message: 'No webhooks to notify' };
    }

    for (const request of requests) {
        const target = webhookLogTarget(request.url);
        targets.push(target);
        const n = notifyWebhook(payload, {
            webhook: request.url,
            method: 'POST',
            workflow_type,
            workflow_id: workflowId,
            workflow_run_id: workflowRunId,
            event_name: eventName,
            body: request.body,
            headers: request.headers,
            timeout_ms: request.timeout_ms,
            auth_mode: request.auth_mode,
        }).then((res) => {
            log.info(`Webhook notified at ${target} with response code: ${res.status}`, { res });
            return res;
        });
        notifications.push(n);
    }

    for (const ep of endpoints) {
        const target = webhookLogTarget(typeof ep === 'string' ? ep : ep.url);
        targets.push(target);
        const n = notifyWebhook(payload, {
            webhook: ep,
            method: 'POST',
            workflow_type,
            workflow_id: workflowId,
            workflow_run_id: workflowRunId,
            event_name: eventName,
            detail: {
                object_ids: objectIds,
                data,
            },
        }).then((res) => {
            log.info(`Webhook notified at ${target} with response code: ${res.status}`, { res });
            return res;
        });
        notifications.push(n);
    }

    // Wait for every notification, so that one receiver's failure doesn't abandon the others while they retry.
    const results = await Promise.allSettled(notifications);
    const res: Awaited<ReturnType<typeof notifyWebhook>>[] = [];
    const failures: { target: string; error: unknown }[] = [];
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            res.push(result.value);
        } else {
            failures.push({ target: targets[i], error: result.reason });
        }
    });
    // Rethrow a cancellation as it is, so that a cancelled run still ends as cancelled.
    const cancellation = failures.find(({ error }) => isCancellation(error));
    if (cancellation) {
        throw cancellation.error;
    }
    if (failures.length > 0) {
        const detail = failures.map(({ target, error }) => `${target}: ${failureMessage(error)}`).join('; ');
        const cause = failures[0].error;
        throw ApplicationFailure.create({
            message: `${failures.length} of ${results.length} webhook notifications failed: ${detail}`,
            type: WEBHOOK_NOTIFICATIONS_FAILED,
            cause: cause instanceof Error ? cause : undefined,
        });
    }
    log.info(`Webhooks notified`);

    return { notifications: res, message: 'Webhooks notified' };
}

/** The activity's own message: an `ActivityFailure` only says that the activity failed. */
function failureMessage(error: unknown): string {
    const failure = error instanceof ActivityFailure && error.cause ? error.cause : error;
    return failure instanceof Error ? failure.message : String(failure);
}
