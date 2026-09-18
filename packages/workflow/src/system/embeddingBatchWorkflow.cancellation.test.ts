import { TestWorkflowEnvironment } from '@temporalio/testing';
import { bundleWorkflowCode, Worker, type WorkflowBundleWithSourceMap } from '@temporalio/worker';
import type { WorkflowExecutionPayload } from '@vertesia/common';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

let environment: TestWorkflowEnvironment;
let workflowBundle: WorkflowBundleWithSourceMap;

beforeAll(async () => {
    environment = await TestWorkflowEnvironment.createTimeSkipping();
    workflowBundle = await bundleWorkflowCode({
        workflowsPath: new URL('./embeddingBatchWorkflow.ts', import.meta.url).pathname,
    });
}, 60_000);

afterAll(async () => {
    await environment?.teardown();
});

it('cancels the accepted provider job when cancellation arrives during submission', async () => {
    let started!: () => void;
    const submissionStarted = new Promise<void>((resolve) => {
        started = resolve;
    });
    let finishSubmission!: () => void;
    const submissionReleased = new Promise<void>((resolve) => {
        finishSubmission = resolve;
    });
    const cancelJob = vi.fn().mockResolvedValue({ name: 'provider/job', state: 'cancelled' });
    const apply = vi.fn().mockResolvedValue({ state: 'cancelled', succeeded: 0, failed: 1, stale: 0, applied: 0 });
    const worker = await Worker.create({
        connection: environment.nativeConnection,
        taskQueue: 'embedding-batch-cancellation',
        workflowBundle,
        activities: {
            ensureFreshAuthToken: () => ({ refreshed: false }),
            prepareEmbeddingBatch: () => ({
                run_id: 'run',
                row_count: 1,
                subjobs: [
                    {
                        index: 0,
                        display_name: 'batch',
                        input_uri: 'gs://bucket/input',
                        output_uri: 'gs://bucket/output/',
                        row_count: 1,
                    },
                ],
            }),
            createEmbeddingBatchJob: async () => {
                started();
                await submissionReleased;
                return { name: 'provider/job', state: 'running' };
            },
            cancelEmbeddingBatchJob: cancelJob,
            applyEmbeddingBatch: apply,
            updateEmbeddingBatch: () => undefined,
        },
    });
    const payload = {
        account_id: 'account',
        project_id: 'project',
        initiated_by: 'user',
        auth_token: 'token',
        objectIds: [],
        vars: {
            embedding_batch: {
                run_id: 'run',
                type: 'text',
                capability: {
                    eligible: true,
                    environment: 'env',
                    model: 'model',
                    dimensions: 768,
                },
            },
        },
    } as unknown as WorkflowExecutionPayload;
    await worker.runUntil(async () => {
        const handle = await environment.client.workflow.start('embeddingBatchWorkflow', {
            workflowId: 'cancel-during-submission',
            taskQueue: 'embedding-batch-cancellation',
            args: [payload],
        });
        await submissionStarted;
        await handle.cancel();
        finishSubmission();
        await expect(handle.result()).rejects.toThrow();
    });
    expect(cancelJob).toHaveBeenCalledWith(
        expect.objectContaining({
            params: expect.objectContaining({ name: 'provider/job' }),
        }),
    );
    expect(apply).toHaveBeenCalledOnce();
});
