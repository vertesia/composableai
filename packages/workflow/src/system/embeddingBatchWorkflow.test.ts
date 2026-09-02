import type { WorkflowExecutionPayload } from '@vertesia/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const activities = vi.hoisted(() => ({
    prepareEmbeddingBatch: vi.fn(),
    createEmbeddingBatchJob: vi.fn(),
    getEmbeddingBatchJob: vi.fn(),
    cancelEmbeddingBatchJob: vi.fn(),
    updateEmbeddingBatch: vi.fn(),
    applyEmbeddingBatch: vi.fn(),
    ensureFreshAuthToken: vi.fn(),
}));
const workflowState = vi.hoisted(() => ({ cancellation: false }));
const temporal = vi.hoisted(() => ({
    condition: vi.fn(async (predicate: () => boolean) => {
        await Promise.resolve();
        return predicate();
    }),
    executeChild: vi.fn().mockResolvedValue({ status: 'completed' }),
    sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../dsl/dslProxyActivities.js', () => ({ dslProxyActivities: () => activities }));
vi.mock('@temporalio/workflow', () => ({
    ActivityCancellationType: { TRY_CANCEL: 'TRY_CANCEL' },
    sleep: temporal.sleep,
    isCancellation: () => workflowState.cancellation,
    CancellationScope: { nonCancellable: (fn: () => unknown) => fn() },
    condition: temporal.condition,
    executeChild: temporal.executeChild,
    ParentClosePolicy: { REQUEST_CANCEL: 'REQUEST_CANCEL' },
}));

import { embeddingBatchWorkflow } from './embeddingBatchWorkflow.js';

const payload = {
    account_id: 'account',
    project_id: 'project',
    initiated_by: 'user',
    auth_token: 'old-token',
    objectIds: [],
    vars: {
        embedding_batch: {
            run_id: 'run',
            type: 'text',
            capability: { eligible: true, environment: 'env', model: 'gemini-embedding-2', dimensions: 768 },
        },
    },
} as unknown as WorkflowExecutionPayload;

describe('embeddingBatchWorkflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        workflowState.cancellation = false;
        temporal.condition.mockImplementation(async (predicate: () => boolean) => {
            await Promise.resolve();
            return predicate();
        });
        temporal.executeChild.mockResolvedValue({ status: 'completed' });
        activities.updateEmbeddingBatch.mockResolvedValue(undefined);
        activities.cancelEmbeddingBatchJob.mockResolvedValue({ name: 'cancelled', state: 'cancelled' });
        activities.ensureFreshAuthToken.mockResolvedValue({ refreshed: false });
        payload.auth_token = 'old-token';
    });

    it('uses a refreshed token for work scheduled after a long-running phase', async () => {
        activities.ensureFreshAuthToken
            .mockResolvedValueOnce({ refreshed: false })
            .mockResolvedValueOnce({ refreshed: true, auth_token: 'fresh-token', exp: 123 });
        activities.prepareEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 0, subjobs: [] });
        activities.applyEmbeddingBatch.mockResolvedValue({
            state: 'completed',
            succeeded: 0,
            failed: 0,
            stale: 0,
            applied: 0,
        });

        await embeddingBatchWorkflow(payload);

        expect(activities.updateEmbeddingBatch).toHaveBeenCalledWith(
            expect.objectContaining({ auth_token: 'fresh-token' }),
            expect.objectContaining({ state: 'applying' }),
        );
    });

    it('submits multiple subjobs, polls to terminal state, applies, and retains provider metadata', async () => {
        const subjobs = [0, 1].map((index) => ({
            index,
            display_name: `job-${index}`,
            input_uri: `gs://b/input-${index}`,
            output_uri: `gs://b/output-${index}/`,
            row_count: 1,
        }));
        activities.prepareEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 2, subjobs });
        activities.createEmbeddingBatchJob
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/1', state: 'running' });
        activities.getEmbeddingBatchJob.mockResolvedValue({ name: 'provider', state: 'succeeded' });
        activities.applyEmbeddingBatch.mockResolvedValue({
            state: 'completed',
            succeeded: 2,
            failed: 0,
            stale: 0,
            applied: 2,
        });

        await expect(embeddingBatchWorkflow(payload)).resolves.toMatchObject({ state: 'completed', applied: 2 });
        expect(activities.createEmbeddingBatchJob).toHaveBeenCalledTimes(2);
        expect(activities.getEmbeddingBatchJob).toHaveBeenCalledTimes(2);
    });

    it('ensures image renditions in a bounded child workflow before preparing provider input', async () => {
        const imagePayload = {
            ...payload,
            vars: {
                embedding_batch: {
                    ...(payload.vars?.embedding_batch as object),
                    type: 'image',
                },
            },
        } as unknown as WorkflowExecutionPayload;
        activities.prepareEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 0, subjobs: [] });
        activities.applyEmbeddingBatch.mockResolvedValue({
            state: 'completed',
            succeeded: 0,
            failed: 0,
            stale: 0,
            applied: 0,
        });

        await embeddingBatchWorkflow(imagePayload);

        expect(temporal.executeChild).toHaveBeenCalledWith(
            'EnsureEmbeddingBatchRenditionsWorkflow',
            expect.objectContaining({
                args: [imagePayload],
                workflowId: 'embedding-batch-renditions-run',
                cancellationType: 'WAIT_CANCELLATION_COMPLETED',
                parentClosePolicy: 'REQUEST_CANCEL',
            }),
        );
        expect(activities.prepareEmbeddingBatch.mock.invocationCallOrder[0]).toBeGreaterThan(
            temporal.executeChild.mock.invocationCallOrder[0],
        );
    });

    it('refreshes parent authentication while a rendition child is still running', async () => {
        let resolveChild: (() => void) | undefined;
        temporal.executeChild.mockReturnValue(
            new Promise((resolve) => {
                resolveChild = () => resolve({ status: 'completed' });
            }),
        );
        temporal.condition.mockResolvedValueOnce(false).mockImplementationOnce(async (predicate: () => boolean) => {
            resolveChild?.();
            await Promise.resolve();
            return predicate();
        });
        activities.ensureFreshAuthToken
            .mockResolvedValueOnce({ refreshed: false })
            .mockResolvedValueOnce({ refreshed: true, auth_token: 'maintained-token', exp: 123 })
            .mockResolvedValue({ refreshed: false });
        activities.prepareEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 0, subjobs: [] });
        activities.applyEmbeddingBatch.mockResolvedValue({
            state: 'completed',
            succeeded: 0,
            failed: 0,
            stale: 0,
            applied: 0,
        });
        const imagePayload = {
            ...payload,
            vars: { embedding_batch: { ...(payload.vars?.embedding_batch as object), type: 'image' } },
        } as unknown as WorkflowExecutionPayload;

        await embeddingBatchWorkflow(imagePayload);

        expect(activities.prepareEmbeddingBatch).toHaveBeenCalledWith(
            expect.objectContaining({ auth_token: 'maintained-token' }),
            expect.anything(),
        );
    });

    it('backs off provider polling to a ten-minute limit', async () => {
        const subjob = {
            index: 0,
            display_name: 'job',
            input_uri: 'gs://b/input',
            output_uri: 'gs://b/output/',
            row_count: 1,
        };
        activities.prepareEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 1, subjobs: [subjob] });
        activities.createEmbeddingBatchJob.mockResolvedValue({ name: 'provider/0', state: 'pending' });
        activities.getEmbeddingBatchJob
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'pending' })
            .mockResolvedValueOnce({ name: 'provider/0', state: 'succeeded' });
        activities.applyEmbeddingBatch.mockResolvedValue({
            state: 'completed',
            succeeded: 1,
            failed: 0,
            stale: 0,
            applied: 1,
        });

        await embeddingBatchWorkflow(payload);

        expect(temporal.sleep.mock.calls.map(([delay]) => delay)).toEqual([
            30_000, 60_000, 120_000, 240_000, 480_000, 600_000, 600_000,
        ]);
    });

    it('completes without provider jobs when preparation produces no valid rows', async () => {
        activities.prepareEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 0, subjobs: [] });
        activities.applyEmbeddingBatch.mockResolvedValue({
            state: 'completed',
            succeeded: 0,
            failed: 0,
            stale: 0,
            applied: 0,
        });
        await expect(embeddingBatchWorkflow(payload)).resolves.toMatchObject({ state: 'completed', applied: 0 });
        expect(activities.createEmbeddingBatchJob).not.toHaveBeenCalled();
        expect(activities.applyEmbeddingBatch).toHaveBeenCalledOnce();
    });

    it('applies partial output from a failed provider subjob', async () => {
        const subjob = {
            index: 0,
            display_name: 'job',
            input_uri: 'gs://b/input',
            output_uri: 'gs://b/output/',
            row_count: 2,
        };
        activities.prepareEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 2, subjobs: [subjob] });
        activities.createEmbeddingBatchJob.mockResolvedValue({ name: 'provider/0', state: 'failed' });
        activities.applyEmbeddingBatch.mockResolvedValue({
            state: 'completed_with_errors',
            succeeded: 1,
            failed: 1,
            stale: 0,
            applied: 1,
        });
        await expect(embeddingBatchWorkflow(payload)).resolves.toMatchObject({
            state: 'completed_with_errors',
            applied: 1,
        });
        expect(activities.applyEmbeddingBatch).toHaveBeenCalledOnce();
    });

    it('cancels accepted jobs and applies partial output when a later submission fails', async () => {
        const subjobs = [0, 1].map((index) => ({
            index,
            display_name: `job-${index}`,
            input_uri: `gs://b/input-${index}`,
            output_uri: `gs://b/output-${index}/`,
            row_count: 1,
        }));
        activities.prepareEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 2, subjobs });
        activities.createEmbeddingBatchJob
            .mockResolvedValueOnce({ name: 'provider/0', state: 'running' })
            .mockRejectedValueOnce(new Error('second submission failed'));
        activities.cancelEmbeddingBatchJob.mockResolvedValue({ name: 'provider/0', state: 'cancelled' });
        activities.applyEmbeddingBatch.mockResolvedValue({
            state: 'completed_with_errors',
            succeeded: 1,
            failed: 1,
            stale: 0,
            applied: 1,
        });

        await expect(embeddingBatchWorkflow(payload)).rejects.toThrow('second submission failed');

        expect(activities.cancelEmbeddingBatchJob).toHaveBeenCalledOnce();
        expect(activities.applyEmbeddingBatch).toHaveBeenCalledOnce();
        expect(activities.updateEmbeddingBatch).toHaveBeenCalledWith(
            payload,
            expect.objectContaining({ state: 'applying', error: { message: 'second submission failed' } }),
        );
    });

    it('cancels submitted provider jobs and applies their terminal partial output', async () => {
        const subjobs = [0, 1].map((index) => ({
            index,
            display_name: `job-${index}`,
            input_uri: `gs://b/input-${index}`,
            output_uri: `gs://b/output-${index}/`,
            row_count: 1,
        }));
        activities.prepareEmbeddingBatch.mockResolvedValue({ run_id: 'run', row_count: 2, subjobs });
        activities.createEmbeddingBatchJob
            .mockResolvedValueOnce({ name: 'provider/0', state: 'running' })
            .mockRejectedValueOnce(new Error('cancelled'));
        activities.cancelEmbeddingBatchJob.mockResolvedValue({ name: 'provider/0', state: 'cancelled' });
        activities.applyEmbeddingBatch.mockResolvedValue({
            state: 'completed_with_errors',
            succeeded: 1,
            failed: 0,
            stale: 0,
            applied: 1,
        });
        workflowState.cancellation = true;

        await expect(embeddingBatchWorkflow(payload)).rejects.toThrow('cancelled');
        expect(activities.cancelEmbeddingBatchJob).toHaveBeenCalledOnce();
        expect(activities.applyEmbeddingBatch).toHaveBeenCalledOnce();
        expect(activities.updateEmbeddingBatch).toHaveBeenCalledWith(
            payload,
            expect.objectContaining({ state: 'cancelled' }),
        );
    });
});
