import type { WorkflowExecutionPayload } from '@vertesia/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const activities = vi.hoisted(() => ({
    prepareVertexEmbeddingBatch: vi.fn(),
    createVertexEmbeddingBatchJob: vi.fn(),
    getVertexEmbeddingBatchJob: vi.fn(),
    cancelVertexEmbeddingBatchJob: vi.fn(),
    deleteVertexEmbeddingBatchJob: vi.fn(),
    updateVertexEmbeddingBatch: vi.fn(),
    applyVertexEmbeddingBatch: vi.fn(),
}));
const workflowState = vi.hoisted(() => ({ cancellation: false }));
const temporal = vi.hoisted(() => ({ sleep: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../dsl/dslProxyActivities.js', () => ({ dslProxyActivities: () => activities }));
vi.mock('@temporalio/workflow', () => ({
    sleep: temporal.sleep,
    isCancellation: () => workflowState.cancellation,
    CancellationScope: { nonCancellable: (fn: () => unknown) => fn() },
}));

import { vertexEmbeddingBatchWorkflow } from './vertexEmbeddingBatchWorkflow.js';

const payload = {
    account_id: 'account',
    project_id: 'project',
    initiated_by: 'user',
    objectIds: [],
    vars: {
        vertex_embedding_batch: {
            run_id: 'run',
            type: 'text',
            capability: { eligible: true, environment: 'env', model: 'gemini-embedding-2', dimensions: 768 },
        },
    },
} as unknown as WorkflowExecutionPayload;

describe('vertexEmbeddingBatchWorkflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        workflowState.cancellation = false;
        activities.updateVertexEmbeddingBatch.mockResolvedValue(undefined);
        activities.deleteVertexEmbeddingBatchJob.mockResolvedValue({ name: 'deleted', state: 'cancelled' });
        activities.cancelVertexEmbeddingBatchJob.mockResolvedValue({ name: 'cancelled', state: 'cancelled' });
    });

    it('submits multiple subjobs, polls to terminal state, applies, and retains provider metadata', async () => {
        const subjobs = [0, 1].map((index) => ({
            index,
            display_name: `job-${index}`,
            input_uri: `gs://b/input-${index}`,
            output_uri: `gs://b/output-${index}/`,
            row_count: 1,
        }));
        activities.prepareVertexEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 2, subjobs });
        activities.createVertexEmbeddingBatchJob
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/1', state: 'running' });
        activities.getVertexEmbeddingBatchJob.mockResolvedValue({ name: 'provider', state: 'succeeded' });
        activities.applyVertexEmbeddingBatch.mockResolvedValue({
            state: 'completed',
            succeeded: 2,
            failed: 0,
            stale: 0,
            applied: 2,
        });

        await expect(vertexEmbeddingBatchWorkflow(payload)).resolves.toMatchObject({ state: 'completed', applied: 2 });
        expect(activities.createVertexEmbeddingBatchJob).toHaveBeenCalledTimes(2);
        expect(activities.getVertexEmbeddingBatchJob).toHaveBeenCalledTimes(2);
        expect(activities.deleteVertexEmbeddingBatchJob).not.toHaveBeenCalled();
    });

    it('backs off provider polling to a ten-minute limit', async () => {
        const subjob = {
            index: 0,
            display_name: 'job',
            input_uri: 'gs://b/input',
            output_uri: 'gs://b/output/',
            row_count: 1,
        };
        activities.prepareVertexEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 1, subjobs: [subjob] });
        activities.createVertexEmbeddingBatchJob.mockResolvedValue({ name: 'provider/0', state: 'pending' });
        activities.getVertexEmbeddingBatchJob
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'succeeded' });
        activities.applyVertexEmbeddingBatch.mockResolvedValue({
            state: 'completed',
            succeeded: 1,
            failed: 0,
            stale: 0,
            applied: 1,
        });

        await vertexEmbeddingBatchWorkflow(payload);

        expect(temporal.sleep.mock.calls.map(([delay]) => delay)).toEqual([
            30_000, 60_000, 120_000, 240_000, 480_000, 600_000, 600_000,
        ]);
    });

    it('completes without provider jobs when preparation produces no valid rows', async () => {
        activities.prepareVertexEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 0, subjobs: [] });
        await expect(vertexEmbeddingBatchWorkflow(payload)).resolves.toEqual({ state: 'completed', applied: 0 });
        expect(activities.createVertexEmbeddingBatchJob).not.toHaveBeenCalled();
    });

    it('applies partial output from a failed provider subjob', async () => {
        const subjob = {
            index: 0,
            display_name: 'job',
            input_uri: 'gs://b/input',
            output_uri: 'gs://b/output/',
            row_count: 2,
        };
        activities.prepareVertexEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 2, subjobs: [subjob] });
        activities.createVertexEmbeddingBatchJob.mockResolvedValue({ name: 'provider/0', state: 'failed' });
        activities.applyVertexEmbeddingBatch.mockResolvedValue({
            state: 'completed_with_errors',
            succeeded: 1,
            failed: 1,
            stale: 0,
            applied: 1,
        });
        await expect(vertexEmbeddingBatchWorkflow(payload)).resolves.toMatchObject({
            state: 'completed_with_errors',
            applied: 1,
        });
        expect(activities.applyVertexEmbeddingBatch).toHaveBeenCalledOnce();
    });

    it('cancels submitted provider jobs and applies their terminal partial output', async () => {
        const subjobs = [0, 1].map((index) => ({
            index,
            display_name: `job-${index}`,
            input_uri: `gs://b/input-${index}`,
            output_uri: `gs://b/output-${index}/`,
            row_count: 1,
        }));
        activities.prepareVertexEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 2, subjobs });
        activities.createVertexEmbeddingBatchJob
            .mockResolvedValueOnce({ name: 'provider/0', state: 'running' })
            .mockRejectedValueOnce(new Error('cancelled'));
        activities.cancelVertexEmbeddingBatchJob.mockResolvedValue({ name: 'provider/0', state: 'cancelled' });
        activities.applyVertexEmbeddingBatch.mockResolvedValue({
            state: 'completed_with_errors',
            succeeded: 1,
            failed: 0,
            stale: 0,
            applied: 1,
        });
        workflowState.cancellation = true;

        await expect(vertexEmbeddingBatchWorkflow(payload)).rejects.toThrow('cancelled');
        expect(activities.cancelVertexEmbeddingBatchJob).toHaveBeenCalledOnce();
        expect(activities.applyVertexEmbeddingBatch).toHaveBeenCalledOnce();
        expect(activities.updateVertexEmbeddingBatch).toHaveBeenCalledWith(
            payload,
            expect.objectContaining({ state: 'cancelled' }),
        );
    });
});
