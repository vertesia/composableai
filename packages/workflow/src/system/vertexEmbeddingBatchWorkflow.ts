import { CancellationScope, isCancellation, sleep } from '@temporalio/workflow';
import type { EmbeddingBatchSubjob, WorkflowExecutionPayload } from '@vertesia/common';
import type * as activities from '../activities/index-dsl.js';
import type { VertexEmbeddingBatchParams } from '../activities/vertexEmbeddingBatch.js';
import { dslProxyActivities } from '../dsl/dslProxyActivities.js';

const batch = dslProxyActivities<typeof activities>('vertexEmbeddingBatchWorkflow', {
    startToCloseTimeout: '30 minute',
    retry: { initialInterval: '5s', backoffCoefficient: 2, maximumAttempts: 8, maximumInterval: '1 minute' },
});

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'paused']);

export async function vertexEmbeddingBatchWorkflow(payload: WorkflowExecutionPayload) {
    const params = payload.vars?.vertex_embedding_batch as unknown as VertexEmbeddingBatchParams;
    if (!params?.run_id || !params.capability?.eligible) throw new Error('Missing Vertex embedding batch parameters');
    let subjobs: EmbeddingBatchSubjob[] = [];
    try {
        const prepared = await batch.prepareVertexEmbeddingBatch(payload, params);
        subjobs = prepared.subjobs;
        if (subjobs.length === 0) {
            await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'completed', subjobs: [] });
            return { state: 'completed', applied: 0 };
        }
        for (const subjob of subjobs) {
            const job = await batch.createVertexEmbeddingBatchJob(payload, { ...params, subjob });
            subjob.provider_name = job.name;
            subjob.state = job.state;
        }
        await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'submitted', subjobs });
        while (subjobs.some((job) => !job.state || !TERMINAL.has(job.state))) {
            await sleep('30 seconds');
            for (const subjob of subjobs) {
                if (!subjob.provider_name || (subjob.state && TERMINAL.has(subjob.state))) continue;
                const job = await batch.getVertexEmbeddingBatchJob(payload, { ...params, name: subjob.provider_name });
                subjob.state = job.state;
            }
            await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'running', subjobs });
        }
        await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'applying', subjobs });
        const result = await batch.applyVertexEmbeddingBatch(payload, { run_id: params.run_id });
        for (const subjob of subjobs)
            if (subjob.provider_name) {
                await batch
                    .deleteVertexEmbeddingBatchJob(payload, { ...params, name: subjob.provider_name })
                    .catch(() => undefined);
            }
        return result;
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
            for (const subjob of subjobs)
                if (subjob.provider_name && (!subjob.state || !TERMINAL.has(subjob.state))) {
                    const job = await batch
                        .cancelVertexEmbeddingBatchJob(payload, { ...params, name: subjob.provider_name })
                        .catch(() => undefined);
                    if (job) subjob.state = job.state;
                }
            while (subjobs.some((job) => job.provider_name && (!job.state || !TERMINAL.has(job.state)))) {
                await sleep('30 seconds');
                for (const subjob of subjobs) {
                    if (!subjob.provider_name || (subjob.state && TERMINAL.has(subjob.state))) continue;
                    const job = await batch.getVertexEmbeddingBatchJob(payload, {
                        ...params,
                        name: subjob.provider_name,
                    });
                    subjob.state = job.state;
                }
            }
            await batch.updateVertexEmbeddingBatch(payload, { run_id: params.run_id, state: 'applying', subjobs });
            try {
                await batch.applyVertexEmbeddingBatch(payload, { run_id: params.run_id });
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
