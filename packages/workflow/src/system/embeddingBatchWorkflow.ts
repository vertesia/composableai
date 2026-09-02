import {
    CancellationScope,
    condition,
    executeChild,
    isCancellation,
    ParentClosePolicy,
    sleep,
} from '@temporalio/workflow';
import type { DSLActivityExecutionPayload, EmbeddingBatchSubjob, WorkflowExecutionPayload } from '@vertesia/common';
import type { EmbeddingBatchParams } from '../activities/embeddingBatch.js';
import type * as activities from '../activities/index-dsl.js';
import { dslProxyActivities } from '../dsl/dslProxyActivities.js';

type BatchWorkflowActivities = typeof activities & {
    ensureFreshAuthToken(
        payload: DSLActivityExecutionPayload<{ force?: boolean }>,
    ): Promise<{ auth_token?: string; exp?: number; refreshed: boolean }>;
};

const WORKFLOW_NAME = 'embeddingBatchWorkflow';

const batch = dslProxyActivities<BatchWorkflowActivities>(WORKFLOW_NAME, {
    startToCloseTimeout: '30 minute',
    retry: { initialInterval: '5s', backoffCoefficient: 2, maximumAttempts: 8, maximumInterval: '1 minute' },
});

const longBatch = dslProxyActivities<BatchWorkflowActivities>(WORKFLOW_NAME, {
    startToCloseTimeout: '4 hours',
    retry: { initialInterval: '15s', backoffCoefficient: 2, maximumAttempts: 4, maximumInterval: '2 minutes' },
});

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'paused']);
const INITIAL_POLL_DELAY_MS = 30_000;
const MAX_POLL_DELAY_MS = 10 * 60_000;
const AUTH_REFRESH_INTERVAL_MS = 10 * 60_000;

function nextPollDelay(delayMs: number): number {
    return Math.min(delayMs * 2, MAX_POLL_DELAY_MS);
}

async function refreshAuthToken(payload: WorkflowExecutionPayload, force = false): Promise<void> {
    const refreshed = await batch.ensureFreshAuthToken(payload, { force });
    if (refreshed.auth_token) payload.auth_token = refreshed.auth_token;
}

async function ensureImageBatchRenditions(payload: WorkflowExecutionPayload, runId: string): Promise<void> {
    let complete = false;
    let failure: unknown;
    const child = executeChild('EnsureEmbeddingBatchRenditionsWorkflow', {
        args: [payload],
        workflowId: `embedding-batch-renditions-${runId}`,
        cancellationType: 'WAIT_CANCELLATION_COMPLETED',
        parentClosePolicy: ParentClosePolicy.REQUEST_CANCEL,
        workflowExecutionTimeout: '30 days',
    }).then(
        () => {
            complete = true;
        },
        (error: unknown) => {
            failure = error;
            complete = true;
        },
    );
    while (!complete) {
        const completedBeforeRefresh = await condition(() => complete, AUTH_REFRESH_INTERVAL_MS);
        if (!completedBeforeRefresh) await refreshAuthToken(payload);
    }
    await child;
    if (failure) throw failure;
}

export async function embeddingBatchWorkflow(payload: WorkflowExecutionPayload) {
    const params = payload.vars?.embedding_batch as unknown as EmbeddingBatchParams;
    if (!params?.run_id || !params.capability?.eligible) throw new Error('Missing embedding batch parameters');
    let subjobs: EmbeddingBatchSubjob[] = [];
    try {
        await refreshAuthToken(payload);
        if (params.type === 'image') {
            await ensureImageBatchRenditions(payload, params.run_id);
            await refreshAuthToken(payload);
        }
        const prepared = await longBatch.prepareEmbeddingBatch(payload, params);
        subjobs = prepared.subjobs;
        if (subjobs.length === 0) {
            await refreshAuthToken(payload);
            await batch.updateEmbeddingBatch(payload, { run_id: params.run_id, state: 'applying', subjobs: [] });
            return longBatch.applyEmbeddingBatch(payload, { run_id: params.run_id });
        }
        for (const subjob of subjobs) {
            await refreshAuthToken(payload);
            const job = await batch.createEmbeddingBatchJob(payload, { ...params, subjob });
            subjob.provider_name = job.name;
            subjob.state = job.state;
        }
        await refreshAuthToken(payload);
        await batch.updateEmbeddingBatch(payload, { run_id: params.run_id, state: 'submitted', subjobs });
        let pollDelayMs = INITIAL_POLL_DELAY_MS;
        while (subjobs.some((job) => !job.state || !TERMINAL.has(job.state))) {
            await sleep(pollDelayMs);
            await refreshAuthToken(payload);
            for (const subjob of subjobs) {
                if (!subjob.provider_name || (subjob.state && TERMINAL.has(subjob.state))) continue;
                const job = await batch.getEmbeddingBatchJob(payload, { ...params, name: subjob.provider_name });
                subjob.state = job.state;
            }
            await batch.updateEmbeddingBatch(payload, { run_id: params.run_id, state: 'running', subjobs });
            pollDelayMs = nextPollDelay(pollDelayMs);
        }
        await refreshAuthToken(payload);
        await batch.updateEmbeddingBatch(payload, { run_id: params.run_id, state: 'applying', subjobs });
        return longBatch.applyEmbeddingBatch(payload, { run_id: params.run_id });
    } catch (error) {
        if (!isCancellation(error)) {
            await CancellationScope.nonCancellable(async () => {
                await refreshAuthToken(payload);
                await batch.updateEmbeddingBatch(payload, {
                    run_id: params.run_id,
                    state: 'failed',
                    subjobs,
                    error: { message: error instanceof Error ? error.message : String(error) },
                });
            });
            throw error;
        }
        await CancellationScope.nonCancellable(async () => {
            await refreshAuthToken(payload);
            if (subjobs.length === 0) {
                await batch.updateEmbeddingBatch(payload, { run_id: params.run_id, state: 'cancelled', subjobs });
                return;
            }
            for (const subjob of subjobs)
                if (subjob.provider_name && (!subjob.state || !TERMINAL.has(subjob.state))) {
                    const job = await batch
                        .cancelEmbeddingBatchJob(payload, { ...params, name: subjob.provider_name })
                        .catch(() => undefined);
                    if (job) subjob.state = job.state;
                }
            let pollDelayMs = INITIAL_POLL_DELAY_MS;
            while (subjobs.some((job) => job.provider_name && (!job.state || !TERMINAL.has(job.state)))) {
                await sleep(pollDelayMs);
                await refreshAuthToken(payload);
                for (const subjob of subjobs) {
                    if (!subjob.provider_name || (subjob.state && TERMINAL.has(subjob.state))) continue;
                    const job = await batch.getEmbeddingBatchJob(payload, {
                        ...params,
                        name: subjob.provider_name,
                    });
                    subjob.state = job.state;
                }
                pollDelayMs = nextPollDelay(pollDelayMs);
            }
            await batch.updateEmbeddingBatch(payload, { run_id: params.run_id, state: 'applying', subjobs });
            try {
                await longBatch.applyEmbeddingBatch(payload, { run_id: params.run_id });
                await batch.updateEmbeddingBatch(payload, { run_id: params.run_id, state: 'cancelled', subjobs });
            } catch (applyError) {
                await batch.updateEmbeddingBatch(payload, {
                    run_id: params.run_id,
                    state: 'failed',
                    subjobs,
                    error: { message: applyError instanceof Error ? applyError.message : String(applyError) },
                });
            }
        });
        throw error;
    }
}
