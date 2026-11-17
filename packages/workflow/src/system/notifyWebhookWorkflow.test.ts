import { ApplicationFailure } from '@temporalio/activity';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { bundleWorkflowCode, Worker, type WorkflowBundleWithSourceMap } from '@temporalio/worker';
import type { DSLActivityExecutionPayload, WorkflowExecutionPayload } from '@vertesia/common';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { NotifyWebhookParams } from '../activities/notifyWebhook.js';

let environment: TestWorkflowEnvironment;
let workflowBundle: WorkflowBundleWithSourceMap;

beforeAll(async () => {
    environment = await TestWorkflowEnvironment.createTimeSkipping();
    workflowBundle = await bundleWorkflowCode({
        workflowsPath: new URL('./notifyWebhookWorkflow.ts', import.meta.url).pathname,
    });
}, 60_000);

afterAll(async () => {
    await environment?.teardown();
});

it('delivers the other notifications before failing the run for a rejected one', async () => {
    const gone = 'https://gone.example.test/hook?token=secret';
    const flaky = 'https://flaky.example.test/hook';
    const attempts = new Map<string, number>();
    const delivered: string[] = [];
    const worker = await Worker.create({
        connection: environment.nativeConnection,
        taskQueue: 'notify-webhook-workflow',
        workflowBundle,
        activities: {
            notifyWebhook: async ({ params }: DSLActivityExecutionPayload<NotifyWebhookParams>) => {
                const url = params.webhook as string;
                const attempt = (attempts.get(url) ?? 0) + 1;
                attempts.set(url, attempt);
                if (url === gone) {
                    throw ApplicationFailure.create({
                        message: 'failed with status: 404 Not Found',
                        type: 'WebhookEndpointError',
                        nonRetryable: true,
                    });
                }
                if (attempt === 1) {
                    throw ApplicationFailure.create({
                        message: 'failed with status: 503 Service Unavailable',
                        type: 'WebhookEndpointError',
                    });
                }
                delivered.push(url);
                return { status: 200, message: 'OK', url };
            },
        },
    });
    const payload = {
        account_id: 'account',
        project_id: 'project',
        initiated_by: 'user',
        auth_token: 'token',
        event: 'completed',
        objectIds: [],
        vars: { endpoints: [gone, flaky] },
    } as unknown as WorkflowExecutionPayload;

    const failure = await worker.runUntil(async () => {
        const handle = await environment.client.workflow.start('notifyWebhookWorkflow', {
            workflowId: 'notify-webhook-one-gone-one-flaky',
            taskQueue: 'notify-webhook-workflow',
            args: [payload],
        });
        return handle.result().then(
            () => undefined,
            (error: unknown) => error,
        );
    });

    expect(delivered).toEqual([flaky]);
    expect(Object.fromEntries(attempts)).toEqual({ [gone]: 1, [flaky]: 2 });
    expect(failure).toMatchObject({
        cause: {
            type: 'WebhookNotificationsFailed',
            message:
                '1 of 2 webhook notifications failed: https://gone.example.test/hook: failed with status: 404 Not Found',
            // Callers that classify failures by type still find the activity's type in the cause chain.
            cause: { cause: { type: 'WebhookEndpointError' } },
        },
    });
});

it('ends a cancelled run as cancelled, even when another notification failed', async () => {
    const gone = 'https://gone.example.test/hook';
    const slow = 'https://slow.example.test/hook';
    let started!: () => void;
    const slowStarted = new Promise<void>((resolve) => {
        started = resolve;
    });
    let release!: () => void;
    const slowReleased = new Promise<void>((resolve) => {
        release = resolve;
    });
    const worker = await Worker.create({
        connection: environment.nativeConnection,
        taskQueue: 'notify-webhook-workflow-cancel',
        workflowBundle,
        activities: {
            notifyWebhook: async ({ params }: DSLActivityExecutionPayload<NotifyWebhookParams>) => {
                if (params.webhook === gone) {
                    throw ApplicationFailure.create({
                        message: '404',
                        type: 'WebhookEndpointError',
                        nonRetryable: true,
                    });
                }
                started();
                await slowReleased;
                return { status: 200, message: 'OK', url: slow };
            },
        },
    });
    const payload = { objectIds: [], vars: { endpoints: [gone, slow] } } as unknown as WorkflowExecutionPayload;

    const status = await worker.runUntil(async () => {
        const handle = await environment.client.workflow.start('notifyWebhookWorkflow', {
            workflowId: 'notify-webhook-cancelled',
            taskQueue: 'notify-webhook-workflow-cancel',
            args: [payload],
        });
        await slowStarted;
        await handle.cancel();
        await handle.result().catch(() => undefined);
        release();
        return (await handle.describe()).status.name;
    });

    expect(status).toBe('CANCELLED');
});
