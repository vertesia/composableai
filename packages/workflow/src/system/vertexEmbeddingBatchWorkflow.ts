import { CancellationScope, isCancellation, sleep } from '@temporalio/workflow';
import type { EmbeddingBatchSubjob, WorkflowExecutionPayload } from '@vertesia/common';
import type * as activities from '../activities/index-dsl.js';
import type { VertexEmbeddingBatchParams } from '../activities/vertexEmbeddingBatch.js';
import { dslProxyActivities } from '../dsl/dslProxyActivities.js';

const batch = dslProxyActivities<typeof activities>('vertexEmbeddingBatchWorkflow', {
    startToCloseTimeout: '30 minute',
    retry: { initialInterval: '5s', backoffCoefficient: 2, maximumAttempts: 8, maximumInterval: '1 minute' },
});

const longBatch = dslProxyActivities<typeof activities>('vertexEmbeddingBatchWorkflow', {
    startToCloseTimeout: '4 hours',
    retry: { initialInterval: '15s', backoffCoefficient: 2, maximumAttempts: 4, maximumInterval: '2 minutes' },
});

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'paused']);
const INITIAL_POLL_DELAY_MS = 30_000;
const MAX_POLL_DELAY_MS = 10 * 60_000;

function nextPollDelay(delayMs: number): number {
    return Math.min(delayMs * 2, MAX_POLL_DELAY_MS);
}

export async function vertexEmbeddingBatchWorkflow(payload: WorkflowExecutionPayload) {
    const params = payload.vars?.vertex_embedding_batch as unknown as VertexEmbeddingBatchParams;
    if (!params?.run_id || !params.capability?.eligible) throw new Error('Missing Vertex embedding batch parameters');
    let subjobs: EmbeddingBatchSubjob[] = [];
    try {
        const prepared = await longBatch.prepareVertexEmbeddingBatch(payload, params);
        subjobs = prepared.subjobs;
        if (subjobs.length === 0) {
            await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'applying', subjobs: [] });
            return longBatch.applyVertexEmbeddingBatch(payload, { run_id: params.run_id });
        }
        for (const subjob of subjobs) {
            const job = await batch.createVertexEmbeddingBatchJob(payload, { ...params, subjob });
            subjob.provider_name = job.name;
            subjob.state = job.state;
        }
        await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'submitted', subjobs });
        let pollDelayMs = INITIAL_POLL_DELAY_MS;
        while (subjobs.some((job) => !job.state || !TERMINAL.has(job.state))) {
            await sleep(pollDelayMs);
            for (const subjob of subjobs) {
                if (!subjob.provider_name || (subjob.state && TERMINAL.has(subjob.state))) continue;
                const job = await batch.getVertexEmbeddingBatchJob(payload, { ...params, name: subjob.provider_name });
                subjob.state = job.state;
            }
            await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'running', subjobs });
            pollDelayMs = nextPollDelay(pollDelayMs);
        }
        await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'applying', subjobs });
        return longBatch.applyVertexEmbeddingBatch(payload, { run_id: params.run_id });
    } catch (error) {
        if (!isCancellation(error)) {
            await CancellationScope.nonCancellable(() =>
                batch.updateVertexEmbeddingBatch(payload, {
                    run_id: params.run_id,
                    state: 'failed',
                    subjobs,
                    error: { message: error instanceof Error ? error.message : String(error) },
                }),
            );
            throw error;
        }
        await CancellationScope.nonCancellable(async () => {
            if (subjobs.length === 0) {
                await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'cancelled', subjobs });
                return;
            }
            for (const subjob of subjobs)
                if (subjob.provider_name && (!subjob.state || !TERMINAL.has(subjob.state))) {
                    const job = await batch
                        .cancelVertexEmbeddingBatchJob(payload, { ...params, name: subjob.provider_name })
                        .catch(() => undefined);
                    if (job) subjob.state = job.state;
                }
            let pollDelayMs = INITIAL_POLL_DELAY_MS;
            while (subjobs.some((job) => job.provider_name && (!job.state || !TERMINAL.has(job.state)))) {
                await sleep(pollDelayMs);
                for (const subjob of subjobs) {
                    if (!subjob.provider_name || (subjob.state && TERMINAL.has(subjob.state))) continue;
                    const job = await batch.getVertexEmbeddingBatchJob(payload, {
                        ...params,
                        name: subjob.provider_name,
                    });
                    subjob.state = job.state;
                }
                pollDelayMs = nextPollDelay(pollDelayMs);
            }
            await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'applying', subjobs });
            try {
                await longBatch.applyVertexEmbeddingBatch(payload, { run_id: params.run_id });
                await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'cancelled', subjobs });
            } catch (applyError) {
                await batch.updateVertexEmbeddingBatch(payload, {
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
